/**
 * art-07-basel31-reporting-delta-calculator.kernel.mjs
 * Basel 3.1 Reporting Delta Calculator — fully deterministic, no PRNG.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-07-basel31-reporting-delta-calculator',
  mcp_name:     'compute_basel31_delta',
  mandate_type: 'capital_assessment',
  version:      '1.0.0',
};

const TOOL_ID = 'art-07-basel31-reporting-delta-calculator';
const TOOL_VERSION = '1.0.0';

// ── Asset class definitions (SA risk weights current vs Basel 3.1) ────────────
const ASSET_CLASSES = [
  { id: 'residential_mortgage', label: 'Residential Mortgage',  current_sa_rw: 0.35, basel31_sa_rw: 0.20, irb_rw: 0.15 },
  { id: 'sme_retail',           label: 'SME Retail',            current_sa_rw: 0.75, basel31_sa_rw: 0.75, irb_rw: 0.60 },
  { id: 'large_corporate',      label: 'Large Corporate',       current_sa_rw: 1.00, basel31_sa_rw: 0.85, irb_rw: 0.72 },
  { id: 'bank',                 label: 'Bank / FI',             current_sa_rw: 0.20, basel31_sa_rw: 0.40, irb_rw: 0.30 },
  { id: 'sovereign',            label: 'Sovereign',             current_sa_rw: 0.00, basel31_sa_rw: 0.00, irb_rw: 0.00 },
  { id: 'equity',               label: 'Equity',                current_sa_rw: 1.00, basel31_sa_rw: 1.50, irb_rw: 1.25 },
];

const OUTPUT_FLOOR = 0.725; // BCBS d424 §CAP30

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  retail_bank: {
    ead_bn: 100,
    approach: 'sa',
    cet1_ratio: 0.155,
    mix: { residential_mortgage: 0.55, sme_retail: 0.20, large_corporate: 0.10, bank: 0.08, sovereign: 0.05, equity: 0.02 },
  },
  wholesale_bank: {
    ead_bn: 200,
    approach: 'irb',
    cet1_ratio: 0.170,
    mix: { residential_mortgage: 0.10, sme_retail: 0.10, large_corporate: 0.40, bank: 0.20, sovereign: 0.15, equity: 0.05 },
  },
  universal_bank: {
    ead_bn: 500,
    approach: 'irb',
    cet1_ratio: 0.160,
    mix: { residential_mortgage: 0.30, sme_retail: 0.15, large_corporate: 0.25, bank: 0.15, sovereign: 0.10, equity: 0.05 },
  },
};

export function compute(pp) {
  // Resolve preset or use custom mix
  const preset = pp.preset ? PRESETS[pp.preset] : null;
  const ead_bn        = pp.ead_bn        ?? preset?.ead_bn        ?? 100;
  const approach      = pp.approach      ?? preset?.approach      ?? 'sa';
  const cet1_ratio    = pp.cet1_ratio    ?? preset?.cet1_ratio    ?? 0.155;
  const mix           = pp.mix           ?? preset?.mix           ?? { residential_mortgage: 1.0 };

  // Per-class calculation
  let current_rwa_bn  = 0;
  let basel31_rwa_bn  = 0;
  const asset_class_summary = [];

  for (const ac of ASSET_CLASSES) {
    const weight = mix[ac.id] ?? 0;
    if (weight === 0) continue;
    const ead_class = ead_bn * weight;
    const rw = approach === 'irb' ? ac.irb_rw : ac.current_sa_rw;
    const current_rwa  = ead_class * rw;
    const basel31_rwa_sa = ead_class * ac.basel31_sa_rw;
    const basel31_irb    = approach === 'irb' ? ead_class * ac.irb_rw : basel31_rwa_sa;
    // For IRB banks: floored at 72.5% of SA
    const basel31_final  = approach === 'irb'
      ? Math.max(basel31_irb, ead_class * ac.basel31_sa_rw * OUTPUT_FLOOR)
      : basel31_rwa_sa;

    current_rwa_bn  += current_rwa;
    basel31_rwa_bn  += basel31_final;

    asset_class_summary.push({
      id:                   ac.id,
      label:                ac.label,
      ead_bn:               +ead_class.toFixed(3),
      current_rwa_bn:       +current_rwa.toFixed(3),
      basel31_rwa_bn:       +basel31_final.toFixed(3),
      rwa_delta_bn:         +(basel31_final - current_rwa).toFixed(3),
      rwa_delta_pct:        current_rwa > 0 ? +((basel31_final / current_rwa - 1) * 100).toFixed(2) : 0,
    });
  }

  const floor_rwa_bn       = current_rwa_bn * OUTPUT_FLOOR;  // 72.5% of current SA
  const output_floor_binding = approach === 'irb' && basel31_rwa_bn < floor_rwa_bn;
  const effective_rwa_bn   = output_floor_binding ? floor_rwa_bn : basel31_rwa_bn;
  const rwa_delta_bn       = +(effective_rwa_bn - current_rwa_bn).toFixed(3);
  const rwa_delta_pct      = current_rwa_bn > 0 ? +((effective_rwa_bn / current_rwa_bn - 1) * 100).toFixed(2) : 0;
  const cet1_bn            = current_rwa_bn * cet1_ratio;
  const cet1_ratio_current_pct  = +(cet1_ratio * 100).toFixed(2);
  const cet1_ratio_basel31_pct  = effective_rwa_bn > 0
    ? +((cet1_bn / effective_rwa_bn) * 100).toFixed(2)
    : cet1_ratio_current_pct;
  const capital_shortfall_bn = +(Math.max(0, (effective_rwa_bn - current_rwa_bn) * 0.08)).toFixed(3);

  const compliance_flags = [];
  if (output_floor_binding) compliance_flags.push('OUTPUT_FLOOR_BINDING');
  else compliance_flags.push('OUTPUT_FLOOR_NOT_BINDING');
  if (rwa_delta_pct > 20)   compliance_flags.push('SIGNIFICANT_RWA_INCREASE');
  if (cet1_ratio_basel31_pct < 10.5) compliance_flags.push('CET1_BELOW_MINIMUM_THRESHOLD');
  else compliance_flags.push('CET1_ADEQUATE');

  return {
    verdict:               rwa_delta_pct > 10 ? 'MATERIAL_IMPACT' : rwa_delta_pct > 0 ? 'MODERATE_IMPACT' : 'MINIMAL_IMPACT',
    current_rwa_bn:        +current_rwa_bn.toFixed(3),
    basel31_rwa_bn:        +effective_rwa_bn.toFixed(3),
    rwa_delta_bn,
    rwa_delta_pct,
    output_floor_binding,
    floor_rwa_bn:          +floor_rwa_bn.toFixed(3),
    capital_shortfall_bn,
    cet1_ratio_current_pct,
    cet1_ratio_basel31_pct,
    asset_class_summary,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = {} } = result;
  const output_payload = result;
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

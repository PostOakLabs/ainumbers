/**
 * sim-03-basel-rwa-scenario-modeler.kernel.mjs
 * Basel RWA Scenario Modeler — LCG PRNG, SA-CR / F-IRB / A-IRB / Output Floor.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'sim-03-basel-rwa-scenario-modeler',
  mcp_name:     'compute_rwa_scenarios',
  mandate_type: 'capital_assessment',
  version:      '1.0.0',
};

const TOOL_ID      = 'sim-03-basel-rwa-scenario-modeler';
const TOOL_VERSION = '1.0.0';

// ── LCG (matches source HTML makeRng) ────────────────────────────────────────
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Error function approximation ─────────────────────────────────────────────
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return x >= 0 ? p : -p;
}

// ── Normal inverse (rational Horner, from source) ────────────────────────────
function phiInv(p) {
  const a = -2.515517, b1 = 0.802853, c1 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const top = a + b1 * t + c1 * t * t;
  const bot = 1 + d1 * t + d2 * t * t + d3 * t * t * t;
  const x = t - top / bot;
  return p < 0.5 ? -x : x;
}

// ── IRB capital formula (BCBS d424 §CRE31, from source irbK) ─────────────────
function irbK(pd, lgd, m = 2.5) {
  const pdC = Math.max(pd, 0.0003);
  const r = 0.12 * (1 - Math.exp(-50 * pdC)) / (1 - Math.exp(-50))
          + 0.24 * (1 - (1 - Math.exp(-50 * pdC)) / (1 - Math.exp(-50)));
  const b = Math.pow(0.11852 - 0.05478 * Math.log(pdC), 2);
  const ma = (1 + (m - 2.5) * b) / (1 - 1.5 * b);
  const phi99 = phiInv(0.999);
  const inner = (phiInv(pdC) + Math.sqrt(r / (1 - r)) * phi99) / Math.sqrt(1 - r);
  const nInner = 0.5 * (1 + erf(inner / Math.sqrt(2)));
  return Math.max(0, (lgd * nInner - lgd * pdC) * ma * 12.5);
}

// ── Basel 3.1 SA-CR weights (from source SA_WEIGHTS) ─────────────────────────
const SA_WEIGHTS = {
  residential: 0.30,
  sme:         0.85,
  large_corp:  0.85,
  consumer:    0.75,
  sovereign:   0.05,
  equity:      1.75,
};

// ── Asset-class PD multipliers ────────────────────────────────────────────────
const ASSET_PD_MULT = {
  residential: 0.6,
  sme:         1.2,
  large_corp:  1.1,
  consumer:    1.4,
  sovereign:   0.2,
  equity:      2.0,
};

// ── Portfolio mix presets ─────────────────────────────────────────────────────
const MIXES = {
  retail:    { residential: 0.70, sme: 0.12, large_corp: 0.05, consumer: 0.10, sovereign: 0.02, equity: 0.01 },
  corporate: { residential: 0.10, sme: 0.20, large_corp: 0.40, consumer: 0.08, sovereign: 0.18, equity: 0.04 },
  mixed:     { residential: 0.35, sme: 0.20, large_corp: 0.22, consumer: 0.12, sovereign: 0.08, equity: 0.03 },
};

const OUTPUT_FLOOR = 0.725; // BCBS d424 §CAP30

// ── Percentile helper ─────────────────────────────────────────────────────────
function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(p * s.length)] ?? 0;
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const ead_bn    = pp.ead_bn    ?? 100;
  const mix_preset = pp.mix_preset ?? 'mixed';
  const mix       = pp.mix       ?? MIXES[mix_preset] ?? MIXES.mixed;
  const mc_n      = Math.min(Math.max(pp.mc_scenarios ?? pp.mc_n ?? 500, 50), 2000);
  const firb_pd   = (pp.firb_pd_pct ?? 1.5) / 100;
  const firb_lgd  = (pp.firb_lgd_pct ?? 45) / 100;
  const airb_pd   = (pp.airb_pd_pct ?? 1.2) / 100;
  const airb_lgd  = (pp.airb_lgd_pct ?? 32) / 100;

  // ── Central SA-CR RWA ────────────────────────────────────────────────────
  let sacr_rwa_bn = 0;
  for (const [cls, wt] of Object.entries(mix)) {
    sacr_rwa_bn += ead_bn * wt * (SA_WEIGHTS[cls] ?? 0.85);
  }

  // ── Central F-IRB RWA ───────────────────────────────────────────────────
  let firb_rwa_bn = 0;
  for (const [cls, wt] of Object.entries(mix)) {
    const pd = Math.min(firb_pd * (ASSET_PD_MULT[cls] ?? 1), 0.99);
    firb_rwa_bn += ead_bn * wt * irbK(pd, firb_lgd);
  }

  // ── Central A-IRB RWA ───────────────────────────────────────────────────
  let airb_rwa_bn = 0;
  for (const [cls, wt] of Object.entries(mix)) {
    const pd = Math.min(airb_pd * (ASSET_PD_MULT[cls] ?? 1), 0.99);
    airb_rwa_bn += ead_bn * wt * irbK(pd, airb_lgd);
  }

  // ── Output floor ────────────────────────────────────────────────────────
  const floor_rwa_bn   = sacr_rwa_bn * OUTPUT_FLOOR;
  const firb_floored_bn = Math.max(firb_rwa_bn, floor_rwa_bn);
  const airb_floored_bn = Math.max(airb_rwa_bn, floor_rwa_bn);
  const floor_binding   = { firb: firb_floored_bn > firb_rwa_bn, airb: airb_floored_bn > airb_rwa_bn };

  // ── Monte Carlo ─────────────────────────────────────────────────────────
  const rng = makeRng(42);
  const sacrSims = [], firbSims = [], airbSims = [];

  for (let i = 0; i < mc_n; i++) {
    const spread = 0.85 + rng() * 0.30;
    let sc = 0, fi = 0, ai = 0;
    for (const [cls, wt] of Object.entries(mix)) {
      const w   = wt * (0.9 + rng() * 0.2);
      const ead = ead_bn * spread * w;
      sc += ead * (SA_WEIGHTS[cls] ?? 0.85) * (0.85 + rng() * 0.30);
      const pdF = Math.min(firb_pd * (ASSET_PD_MULT[cls] ?? 1) * (0.7 + rng() * 0.6), 0.99);
      fi += ead * irbK(pdF, firb_lgd * (0.85 + rng() * 0.3));
      const pdA = Math.min(airb_pd * (ASSET_PD_MULT[cls] ?? 1) * (0.7 + rng() * 0.6), 0.99);
      ai += ead * irbK(pdA, airb_lgd * (0.8 + rng() * 0.4));
    }
    sacrSims.push(sc);
    firbSims.push(Math.max(fi, sc * OUTPUT_FLOOR));
    airbSims.push(Math.max(ai, sc * OUTPUT_FLOOR));
  }

  const PERCENTILES = [0.05, 0.25, 0.50, 0.75, 0.95, 0.99];
  const sacr_pcts = PERCENTILES.map(p => +pct(sacrSims, p).toFixed(3));
  const firb_pcts = PERCENTILES.map(p => +pct(firbSims, p).toFixed(3));
  const airb_pcts = PERCENTILES.map(p => +pct(airbSims, p).toFixed(3));

  const compliance_flags = [];
  if (floor_binding.firb || floor_binding.airb) compliance_flags.push('OUTPUT_FLOOR_BINDING');
  else compliance_flags.push('OUTPUT_FLOOR_NOT_BINDING');
  if (sacr_rwa_bn > 0) {
    const irb_saving = (sacr_rwa_bn - airb_floored_bn) / sacr_rwa_bn;
    if (irb_saving > 0.10) compliance_flags.push('SIGNIFICANT_IRB_CAPITAL_SAVING');
  }

  return {
    verdict:         floor_binding.firb || floor_binding.airb ? 'FLOOR_BINDING' : 'IRB_BENEFIT_AVAILABLE',
    sacr_rwa_bn:     +sacr_rwa_bn.toFixed(3),
    firb_rwa_bn:     +firb_rwa_bn.toFixed(3),
    airb_rwa_bn:     +airb_rwa_bn.toFixed(3),
    floor_rwa_bn:    +floor_rwa_bn.toFixed(3),
    firb_floored_bn: +firb_floored_bn.toFixed(3),
    airb_floored_bn: +airb_floored_bn.toFixed(3),
    floor_binding,
    sacr_pcts,
    firb_pcts,
    airb_pcts,
    percentile_labels: ['P5', 'P25', 'P50', 'P75', 'P95', 'P99'],
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

/**
 * art-72-cbam-precursor-emissions-aggregator.kernel.mjs
 * Wave 16 — CBAM Precursor-Emissions Aggregator.
 * Rolls up embedded emissions across precursors in a steel/aluminium value chain
 * (incl. the 2028 pre-consumer-scrap rule) so a producer can supply complex-goods
 * emissions to its importer. Pre-positions the downstream-180 scope extension.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CBAM Implementing Regulation (precursors / complex goods methodology).
 *   2025 downstream-extension proposal: Council position 12 Jun 2026,
 *     application 1 Jan 2028. Verify final text.
 *   EDUCATIONAL: outputs are decision-support drafts, not official declarations.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-72-cbam-precursor-emissions-aggregator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'aggregate_cbam_precursor_emissions',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

export function compute(pp) {
  const {
    final_good: {
      cn_code         = '',
      quantity_tonnes = 1,
    } = {},
    precursors        = [],  // [{ cn_code, mass_fraction, see_tco2e_per_t, source }]
    scrap_input_share = 0,   // 0–1 (2028 pre-consumer-scrap rule — verify)
  } = pp;

  if (precursors.length === 0) {
    const output_payload = {
      cumulative_see_tco2e: 0,
      precursor_breakdown:  [],
      scrap_adjustment:     0,
      data_quality_grade:   'INCOMPLETE',
      quantity_tonnes,
      note: 'No precursors provided. Supply precursor data to compute complex-goods embedded emissions. DECISION-SUPPORT DRAFT.',
    };
    return { output_payload, compliance_flags: ['PRECURSOR_DATA_MISSING'] };
  }

  // ── Weighted roll-up ──
  const totalFraction = precursors.reduce((s, p) => s + (p.mass_fraction ?? 0), 0);
  const precursor_breakdown = precursors.map(p => {
    const mf        = +(p.mass_fraction ?? 0);
    const see       = +(p.see_tco2e_per_t ?? 0);
    const contrib   = +(mf * see).toFixed(4);
    return {
      cn_code:           p.cn_code ?? '',
      mass_fraction:     mf,
      see_tco2e_per_t:   see,
      contribution_tco2e_per_t: contrib,
      source:            p.source ?? 'unknown',
    };
  });

  let raw_see = +precursor_breakdown.reduce((s, p) => s + p.contribution_tco2e_per_t, 0).toFixed(4);

  // ── 2028 pre-consumer-scrap rule (apply if scrap_input_share > 0) ──
  // Scrap inputs may carry zero or reduced embedded emissions under the 2028 rule.
  // Verify final text when Council position is adopted. Currently modelled as
  // a proportional zero-SEE credit for the scrap share.
  const scrap_adjustment = scrap_input_share > 0
    ? -(raw_see * Math.min(scrap_input_share, 1) * 0.5).toFixed(4)  // 50% credit proxy — verify
    : 0;

  const cumulative_see_per_tonne = +Math.max(0, raw_see + +scrap_adjustment).toFixed(4);
  const cumulative_see_tco2e     = +(cumulative_see_per_tonne * quantity_tonnes).toFixed(3);

  // ── Data quality grade ──
  const hasDefault = precursors.some(p => p.source === 'default');
  const fractionOk  = Math.abs(totalFraction - 1) < 0.05;
  const data_quality_grade = !fractionOk ? 'FRACTION_ERROR'
    : hasDefault ? 'MIXED_DEFAULT_ACTUAL'
    : 'ACTUAL_DATA';

  // ── Compliance flags ──
  const compliance_flags = [];
  if (hasDefault)             compliance_flags.push('PRECURSOR_DEFAULT_USED');
  if (scrap_input_share > 0)  compliance_flags.push('SCRAP_RULE_APPLIED');
  if (!fractionOk)            compliance_flags.push('MASS_FRACTION_SUM_ERROR');

  const output_payload = {
    cumulative_see_tco2e,
    cumulative_see_per_tonne,
    precursor_breakdown,
    scrap_adjustment: +scrap_adjustment,
    data_quality_grade,
    quantity_tonnes,
    total_mass_fraction: +totalFraction.toFixed(4),
    scrap_rule: {
      applied:            scrap_input_share > 0,
      scrap_input_share:  +scrap_input_share,
      note:               'Pre-consumer-scrap rule: Council position 12 Jun 2026, application 1 Jan 2028. Credit modelling is approximate — verify final text.',
    },
    note: 'DECISION-SUPPORT DRAFT — not an official CBAM declaration. Precursor methodology: CBAM Implementing Regulation (complex goods). Scrap rule credit is a preliminary approximation; verify against final Implementing Regulation text. Mass fractions must sum to ≈1.0 for reliable results.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

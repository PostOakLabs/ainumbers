import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-251-compute-parametric-trigger-payout';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// Parametric insurance trigger evaluation and payout computation.
// Supports three trigger types: threshold, tiered, and linear_index.
// ZERO PII: index values, thresholds, and coverage amounts only.
// TABLE_VERSION pins the trigger methodology revision for §17 kernel identity.
// anchor_surface: anchor.ainumbers.co/mcp -- anchor execution_hash to create
// a neutral, tamper-evident trigger receipt that neither policyholder nor insurer
// can retroactively alter (ZERO-basis dispute artifact).

const TABLE_VERSION = 'PARAMETRIC-TRIGGER-MATH-V1.0-2025';
const TABLE_SOURCE  = 'ISO 11116:2023 (parametric insurance); Swiss Re sigma 1/2024 (cat bond triggers); AIR Worldwide trigger methodology guide 2023';

export function compute(params) {
  const p = params || {};

  const trigger_type     = ['threshold','tiered','linear_index'].includes(p.trigger_type) ? p.trigger_type : 'threshold';
  const index_value      = _finite(p.index_value, 0);
  const threshold        = _finite(p.threshold, 0);
  const coverage_amount  = _finite(p.coverage_amount, 0);
  const parametric_limit = _finite(p.parametric_limit, coverage_amount);
  const max_index        = _finite(p.max_index, threshold > 0 ? threshold * 2 : 1);

  // Tiered: array of {lower_bound, upper_bound, payout_pct}
  const tier_table = Array.isArray(p.tier_table) ? p.tier_table : [];

  let payout_amount    = 0;
  let trigger_fraction = 0;
  let trigger_hit      = false;
  let tier_matched     = null;
  let linear_fraction  = 0;

  if (trigger_type === 'threshold') {
    // Binary: full payout if index_value >= threshold
    trigger_hit      = index_value >= threshold;
    trigger_fraction = trigger_hit ? 1 : 0;
    payout_amount    = trigger_hit ? Math.min(coverage_amount, parametric_limit) : 0;

  } else if (trigger_type === 'tiered') {
    // First matching tier by lower_bound <= index_value < upper_bound
    for (let i = 0; i < tier_table.length; i++) {
      const t = tier_table[i];
      const lo  = _finite(t.lower_bound, 0);
      const hi  = _finite(t.upper_bound, 0);
      const pct = _finite(t.payout_pct,  0);
      if (index_value >= lo && (hi === 0 || index_value < hi)) {
        trigger_fraction = _round4(Math.max(0, Math.min(1, pct / 100)));
        payout_amount    = _round2(Math.min(coverage_amount * trigger_fraction, parametric_limit));
        trigger_hit      = payout_amount > 0;
        tier_matched     = i;
        break;
      }
    }
    if (tier_matched === null) {
      // Above all tiers -- full payout
      trigger_fraction = 1;
      payout_amount    = _round2(Math.min(coverage_amount, parametric_limit));
      trigger_hit      = payout_amount > 0;
    }

  } else {
    // linear_index: payout = (index_value - threshold) / (max_index - threshold) * coverage_amount
    const span = max_index - threshold;
    if (span <= 0) {
      // Degenerate: threshold >= max -- no payout
      linear_fraction  = 0;
    } else {
      linear_fraction = Math.max(0, Math.min(1, (index_value - threshold) / span));
    }
    trigger_fraction = _round4(linear_fraction);
    payout_amount    = _round2(Math.min(coverage_amount * trigger_fraction, parametric_limit));
    trigger_hit      = payout_amount > 0;
  }

  payout_amount = _round2(payout_amount);

  // Trigger receipt fields -- all numeric, ZERO PII
  const trigger_receipt = {
    trigger_type,
    index_value,
    threshold_used: threshold,
    max_index_used: trigger_type === 'linear_index' ? max_index : null,
    trigger_fraction,
    trigger_hit,
    payout_amount,
    coverage_amount,
    parametric_limit,
    tier_matched_index: tier_matched,
  };

  return {
    trigger_hit,
    payout_amount,
    trigger_fraction,
    trigger_type_used: trigger_type,
    coverage_amount,
    parametric_limit,
    index_value,
    threshold_used: threshold,
    tier_matched_index: tier_matched,
    trigger_receipt,
    table_version:   TABLE_VERSION,
    table_source:    TABLE_SOURCE,
    regulatory_basis:'ISO 11116:2023 parametric insurance trigger methodology; Swiss Re sigma 1/2024 cat bond trigger types (indemnity / industry loss / parametric / modelled); trigger receipt = neutral dispute artifact per IAIS ICP 19 claims handling principle.',
    pii_note:        'ZERO PII: index values, thresholds, and coverage amounts only. No policyholder, event-location, or personal data enters this kernel.',
    anchor_surface:  'anchor.ainumbers.co/mcp -- anchor execution_hash immediately upon trigger event to create a tamper-evident dispute artifact that neither policyholder nor insurer controls (neutral adjudication record).',
    not_legal_advice:'Not legal or actuarial advice. Trigger determinations require review by a licensed actuary and the controlling policy language.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round4(v) { return Math.round(v * 10000) / 10000; }
function _round2(v) { return Math.round(v * 100)   / 100;   }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

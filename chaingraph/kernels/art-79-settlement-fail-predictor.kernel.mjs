/**
 * art-79-settlement-fail-predictor.kernel.mjs
 * Wave 17 — Settlement-Fail Predictor.
 * Scores a trade's fail probability from anonymized configuration features —
 * SSI match status, instrument liquidity tier, counterparty fail-history band,
 * market deadline proximity, partial-settlement availability.
 * No PII: features are categorical/band-level, never counterparty identities.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   SSI fail data: ~30% of fails from incorrect/stale SSIs
 *     (EquiLend, FinOps; verify against current data).
 *   CSDR settlement-efficiency context: ESMA annual reports.
 *   Methodology: transparent weighted scorecard (documented feature weights).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-79-settlement-fail-predictor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'predict_settlement_fail',
  mandate_type: 'model_governance',
  gpu:          false,
};

// ─── Feature weights (documented, transparent scorecard) ─────────────────────
// All features are categorical/band-level — no PII, no counterparty identities.
const FEATURE_WEIGHTS = {
  ssi_match_status:       { matched: 0, mismatched: 0.45, missing: 0.65 },
  liquidity_tier:         { liquid: 0, semi_liquid: 0.15, illiquid: 0.30 },
  counterparty_fail_band: { low: 0, med: 0.15, high: 0.30 },
  deadline_proximity:     { ample: 0, tight: 0.20, breached: 0.50 },
  partial_available:      { true: -0.05, false: 0 },
  inventory_status:       { long: 0, short: 0.20, uncertain: 0.10 },
};

// Dominant-driver label map
const DRIVER_LABELS = {
  ssi_match_status:       'SSI mismatch / missing (~30% of fails — EquiLend/FinOps)',
  deadline_proximity:     'Deadline breach risk',
  inventory_status:       'Short/uncertain inventory',
  counterparty_fail_band: 'Counterparty high fail-history',
  liquidity_tier:         'Illiquid instrument',
};

const ACTIONS = {
  ssi_match_status_mismatched: 'Resolve SSI mismatch with counterparty before settlement date. Run sd-ssi-hygiene chain.',
  ssi_match_status_missing:    'Source correct SSI from golden-source provider (S&P SSI Automate / DTCC). Run sd-ssi-hygiene chain.',
  deadline_proximity_breached: 'Settlement deadline already breached — initiate manual intervention / recall. Run sd-penalty chain.',
  deadline_proximity_tight:    'Settlement window closing — prioritise matching confirmation now.',
  inventory_status_short:      'Arrange securities borrowing / pre-positioning to cover short position.',
  counterparty_fail_band_high: 'Flag for pre-settlement confirmation call with counterparty.',
  liquidity_tier_illiquid:     'Allow extended settlement runway; consider partial settlement.',
  default:                     'Monitor; no immediate action required.',
};

const probBand = (score) =>
  score >= 0.70 ? 'VERY_HIGH' :
  score >= 0.50 ? 'HIGH' :
  score >= 0.30 ? 'MEDIUM' :
  score >= 0.10 ? 'LOW' : 'NEGLIGIBLE';

export function compute(pp) {
  const { trades = [] } = pp;

  const scored_trades = trades.map((t, idx) => {
    const w = FEATURE_WEIGHTS;
    const feats = {
      ssi_match_status:       t.ssi_match_status       ?? 'matched',
      liquidity_tier:         t.liquidity_tier         ?? 'liquid',
      counterparty_fail_band: t.counterparty_fail_band ?? 'low',
      deadline_proximity:     t.deadline_proximity     ?? 'ample',
      partial_available:      String(t.partial_available ?? true),
      inventory_status:       t.inventory_status       ?? 'long',
    };

    let score = 0;
    let dominant_driver = null;
    let dominant_contrib = 0;
    let recommended_action = ACTIONS.default;

    for (const [feat, val] of Object.entries(feats)) {
      const contrib = (w[feat]?.[val] ?? 0);
      score += contrib;
      if (contrib > dominant_contrib) {
        dominant_contrib = contrib;
        dominant_driver  = feat;
      }
    }
    score = Math.min(1, Math.max(0, score));

    if (dominant_driver) {
      const actionKey = `${dominant_driver}_${feats[dominant_driver]}`;
      recommended_action = ACTIONS[actionKey] ?? DRIVER_LABELS[dominant_driver] ?? ACTIONS.default;
    }

    return {
      trade_index:          idx,
      fail_probability_band: probBand(score),
      fail_probability_score: +score.toFixed(3),
      dominant_driver:       dominant_driver ? (DRIVER_LABELS[dominant_driver] ?? dominant_driver) : 'None',
      recommended_action,
    };
  });

  const batch_fail_rate_estimate = trades.length > 0
    ? +(scored_trades.filter(t => t.fail_probability_band === 'HIGH' || t.fail_probability_band === 'VERY_HIGH').length / trades.length * 100).toFixed(1)
    : 0;

  const driver_counts = {};
  for (const t of scored_trades) {
    driver_counts[t.dominant_driver] = (driver_counts[t.dominant_driver] ?? 0) + 1;
  }
  const top_drivers = Object.entries(driver_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([driver, count]) => ({ driver, count }));

  const compliance_flags = [];
  if (scored_trades.some(t => t.dominant_driver?.includes('SSI')))          compliance_flags.push('MISSING_SSI_HIGH_RISK');
  if (scored_trades.some(t => t.fail_probability_band === 'VERY_HIGH' && t.dominant_driver?.includes('Deadline'))) compliance_flags.push('DEADLINE_BREACH_RISK');
  if (scored_trades.some(t => t.dominant_driver?.includes('Short')))        compliance_flags.push('SHORT_INVENTORY');

  const output_payload = {
    scored_trades,
    batch_fail_rate_estimate,
    top_drivers,
    trade_count:   trades.length,
    methodology: {
      description:  'Transparent weighted feature scorecard. Feature weights are documented above. No ML black-box — fully interpretable.',
      feature_weights: {
        ssi_match_status:       'mismatched=0.45, missing=0.65',
        deadline_proximity:     'tight=0.20, breached=0.50',
        inventory_status:       'short=0.20, uncertain=0.10',
        counterparty_fail_band: 'med=0.15, high=0.30',
        liquidity_tier:         'semi_liquid=0.15, illiquid=0.30',
        partial_available:      'false=0 (no deduction), true=-0.05',
      },
      data_source: 'SSI fail-rate: ~30% of fails (EquiLend / FinOps — verify current data)',
    },
    note: 'DECISION-SUPPORT DRAFT — probability scores are indicative band estimates from a weighted categorical scorecard. Not a machine-learning model. Feature weights are approximate; calibrate against your firm\'s actual fail history. No PII — all features are categorical/band-level.',
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

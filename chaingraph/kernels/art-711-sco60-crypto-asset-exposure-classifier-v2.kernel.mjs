import { executionHash } from './_hash.mjs';

// art-711-sco60-crypto-asset-exposure-classifier-v2 — book-level Group 2
// exposure-limit assessor. The caller supplies the bank's Tier 1 capital and the
// Group 2 book as per-cryptoasset positions, each carrying ABSOLUTE long and
// short legs already delta-adjusted; the kernel aggregates the legs per
// cryptoasset and measures each asset at the HIGHER of its two absolute
// totals (never a netted figure), sums the per-asset figures into one
// aggregate, and assesses that aggregate against two thresholds: a 1%
// general-expectation threshold and a 2% hard limit, both as a percentage of
// Tier 1.
//
// TWO-THRESHOLD CONSEQUENCE LADDER (the reason this successor exists):
//   at or below 1%      — no finding, no notification, no treatment change.
//   above 1%, at or below 2% — the expectation threshold is crossed: a
//                         supervisor-notification flag and the treatment of the
//                         EXCESS over 1% of Tier 1 at the conservative 1250%
//                         Group 2b weight; the remainder keeps its own
//                         treatment. This band is NOT a limit breach: the
//                         breach member stays false and the Pillar 3 precheck
//                         is unaffected.
//   above 2%            — the limit is breached: the WHOLE aggregate takes the
//                         1250% weight, the precheck fails, and the breach gap
//                         and flags fire.
//
// INTEGER-SAFE BOUNDARIES: every amount is an integer minor unit. Threshold
// decisions never divide — they cross-multiply (exposure*100 > tier1,
// exposure*100 > 2*tier1), so an aggregate computed in floating point can
// never flip a boundary result. Exactly 1% and exactly 2% sit INSIDE the
// compliant side of each comparison (strict >). The capital input is required
// to be divisible by 100 minor units so 1% and 2% of it are exact integers
// and the excess amount is exact; anything else is a typed refusal, never a
// rounded verdict.
//
// SCOPE: this node assesses the AGGREGATE book against the limit. It does not
// classify individual assets into groups, apply the infrastructure-risk
// add-on, or decide any hedging question — those remain the earlier
// single-position classifier's decisions. The caller owns the delta-adjusted
// leg figures, the completeness of the book (all direct and indirect holdings
// are supplied as positions), and the Tier 1 figure. No clock, no randomness,
// no text encoding, no network: a pure function of the declared input domain.
// National implementation of the underlying standard varies by jurisdiction;
// this node never asserts that any jurisdiction has adopted it.

const TOOL_ID = 'art-711-sco60-crypto-asset-exposure-classifier-v2';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_sco60_exposure_v2',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Thresholds as multipliers of Tier 1: 1% general-expectation threshold (0.01)
// and 2% hard limit (0.02). Comparisons never form the fraction — they
// cross-multiply exposure*100 against tier1*multiplier, strict > only, so the
// boundary values belong to the compliant side and no float can flip them.
const EXPECTATION_MULTIPLIER = 1;
const HARD_LIMIT_MULTIPLIER = 2;
// The conservative Group 2b weight applied to the excess (or, above the hard
// limit, to the whole aggregate).
const GROUP2B_WEIGHT_PCT = 1250;
// Integer-safety envelope: a capital input at the cap times the largest
// cross-multiplier (200) stays far below 2^53.
const AMOUNT_CAP = 1e12;
const MAX_POSITIONS = 10000;
const HOLDING_TYPES = ['direct_cash', 'direct_derivative', 'indirect_fund', 'indirect_etn'];
const SCOPE_NOTE =
  'Book-level Group 2 exposure-limit assessment. Legs are aggregated per cryptoasset and each ' +
  'asset is counted at the higher of its absolute long and short totals, never a netted figure; ' +
  'legs must already be delta-adjusted for derivatives. The caller owns the completeness of the ' +
  'book: every direct holding (cash and derivatives) and indirect holding (funds, ETF/ETN or ' +
  'similar) must be supplied as a position. Tier 1 capital is caller-supplied and must be a ' +
  'multiple of 100 minor units so the 1% and 2% thresholds and the excess amount are exact ' +
  'integers. The 1250% weight shown is the treatment of the excess (or, above the 2% hard ' +
  'limit, of the whole aggregate); the remainder keeps its own per-asset treatment, which this ' +
  'node does not classify. National implementation of the underlying standard varies; no ' +
  'adoption status is asserted.';

// ---------- refusal plumbing ----------

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  const domain_errors = [{ code: reason, text }];
  return {
    output_payload: {
      group2_exposure_amount: null,
      bank_tier1_capital: null,
      group2_exposure_pct_tier1: null,
      one_pct_tier1_amount: null,
      two_pct_tier1_amount: null,
      group2_threshold_crossed: null,
      group2_limit_breached: null,
      group2b_excess_amount: null,
      group2b_treatment: null,
      risk_weight_applied_pct: null,
      base_risk_weight_pct: GROUP2B_WEIGHT_PCT,
      pillar3_precheck_pass: null,
      per_asset: [],
      gaps: [],
      warnings: [],
      domain_errors,
      refusal_reason: reason,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: [],
  };
}

// ---------- validation ----------

/** @type {(v: unknown, max: number) => boolean} non-negative integer within the safe range */
function isAmount(v, max) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
}

/** @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null} */
function validate(pp) {
  const tier1 = pp.bank_tier1_capital;
  if (!isAmount(tier1, AMOUNT_CAP)) {
    return refused('REFUSED_BAD_TIER1', 'bank_tier1_capital must be a non-negative integer of minor units within the 1e12 cap; zero or negative capital is outside the declared domain, never a zero-division verdict');
  }
  if (tier1 === 0) {
    return refused('REFUSED_BAD_TIER1', 'bank_tier1_capital must be positive; zero capital would make every percentage of it degenerate and is refused rather than reported as 0% or Infinity');
  }
  if (tier1 % 100 !== 0) {
    return refused('REFUSED_BAD_TIER1', 'bank_tier1_capital must be divisible by 100 minor units so that 1% and 2% of it and the excess amount are exact integers; a fractional-threshold verdict is never emitted');
  }
  const positions = pp.group2_positions;
  if (!Array.isArray(positions) || positions.length === 0) {
    return refused('REFUSED_BAD_POSITIONS', 'group2_positions must be a non-empty array of per-cryptoasset positions; an empty book cannot be assessed against the limit');
  }
  if (positions.length > MAX_POSITIONS) {
    return refused('REFUSED_BAD_POSITIONS', 'group2_positions exceeds the ' + MAX_POSITIONS + ' position cap');
  }
  for (const p of positions) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      return refused('REFUSED_BAD_POSITION_ENTRY', 'every group2_positions entry must be an object naming a cryptoasset with absolute long and short legs');
    }
    if (typeof p.cryptoasset !== 'string' || !p.cryptoasset) {
      return refused('REFUSED_BAD_POSITION_ENTRY', 'every position needs a non-empty cryptoasset name');
    }
    if (p.holding_type !== undefined && !HOLDING_TYPES.includes(p.holding_type)) {
      return refused('REFUSED_BAD_POSITION_ENTRY', "holding_type must be one of '" + HOLDING_TYPES.join("', '") + "' when present");
    }
    if (!isAmount(p.long_exposure, AMOUNT_CAP) || !isAmount(p.short_exposure, AMOUNT_CAP)) {
      return refused('REFUSED_BAD_POSITION_ENTRY', 'long_exposure and short_exposure must be non-negative integers within the 1e12 cap; send absolute leg values, already delta-adjusted for derivatives');
    }
  }
  return null;
}

// ---------- compute ----------

/**
 * compute(pp) — pure Group 2 exposure-limit assessment over the declared domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) {
    // Conditional emission (FLAGS-COMPUTED-LINT-1): the input flag is pushed
    // only behind the branch that earns it, never unconditionally.
    const refusedFlags = [];
    if (bad.output_payload.domain_errors.length > 0) refusedFlags.push('ART711_INPUT_REFUSED');
    return { output_payload: bad.output_payload, compliance_flags: refusedFlags };
  }

  const tier1 = pp.bank_tier1_capital;
  // A clean run carries NO flag at all; every flag here is conditional, pushed
  // only behind the branch whose condition earns it.
  const flags = [];
  const warnings = [];

  // Measurement: per cryptoasset, sum the legs across every supplied entry for
  // that asset, then count the HIGHER of the two absolute aggregates — never a
  // netted figure, and never a per-entry higher-of that would double-count an
  // asset the caller happens to hold through two channels. Input order is the
  // declared order; the first entry's holding_type labels the asset (it is
  // scope information and never feeds the count).
  const byAsset = new Map();
  for (const p of pp.group2_positions) {
    const key = p.cryptoasset;
    if (!byAsset.has(key)) {
      byAsset.set(key, {
        cryptoasset: key,
        holding_type: p.holding_type === undefined ? 'direct_cash' : p.holding_type,
        long_exposure: 0,
        short_exposure: 0,
      });
    }
    const a = byAsset.get(key);
    a.long_exposure += p.long_exposure;
    a.short_exposure += p.short_exposure;
  }
  const per_asset = [...byAsset.values()].map((a) => {
    const counted = a.long_exposure >= a.short_exposure ? a.long_exposure : a.short_exposure;
    return { ...a, counted_exposure: counted };
  });

  let exposure = 0;
  for (const a of per_asset) exposure += a.counted_exposure;
  if (exposure > AMOUNT_CAP) {
    return refused('REFUSED_OVERFLOW_CAP', 'the aggregate Group 2 exposure would exceed the 1e12 minor-unit cap that keeps every threshold comparison inside exact integer arithmetic');
  }

  const onePct = tier1 / 100;
  const twoPct = onePct * 2;
  // Strict-> cross-multiplied comparisons over exact integers; exactly 1% and
  // exactly 2% stay on the compliant side. tier1*1 and tier1*2 are exact
  // integers under the cap, so no boundary can flip through floating point.
  const crossed = exposure * 100 > tier1 * EXPECTATION_MULTIPLIER;
  const limitBreached = exposure * 100 > tier1 * HARD_LIMIT_MULTIPLIER;

  const excess = limitBreached ? exposure : (crossed ? exposure - onePct : 0);
  const treatment = limitBreached ? 'whole_book' : (crossed ? 'excess_only' : 'none');

  if (crossed) {
    // A breach implies a crossing, so the notification flag is pushed once,
    // here, and the breach block adds only its own members.
    flags.push('SCO60_GROUP2_1PCT_THRESHOLD_CROSSED', 'SUPERVISOR_NOTIFICATION_REQUIRED');
    warnings.push('SCO60_GROUP2_1PCT_THRESHOLD_CROSSED', 'SUPERVISOR_NOTIFICATION_REQUIRED');
  }
  if (limitBreached) {
    flags.push('SCO60_GROUP2_LIMIT_BREACHED', 'DIS55_PRECHECK_FAIL');
    warnings.push('SCO60_GROUP2_LIMIT_BREACHED', 'DIS55_PRECHECK_FAIL');
  }

  const gaps = limitBreached ? ['GROUP2_EXPOSURE_LIMIT_BREACHED'] : [];

  return {
    output_payload: {
      group2_exposure_amount: exposure,
      bank_tier1_capital: tier1,
      group2_exposure_pct_tier1: (exposure * 100) / tier1,
      one_pct_tier1_amount: onePct,
      two_pct_tier1_amount: twoPct,
      group2_threshold_crossed: crossed,
      group2_limit_breached: limitBreached,
      group2b_excess_amount: excess,
      group2b_treatment: treatment,
      risk_weight_applied_pct: excess > 0 ? GROUP2B_WEIGHT_PCT : null,
      base_risk_weight_pct: GROUP2B_WEIGHT_PCT,
      pillar3_precheck_pass: !limitBreached,
      per_asset,
      gaps,
      warnings,
      domain_errors: [],
      refusal_reason: null,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

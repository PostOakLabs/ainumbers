/**
 * art-319-rhc-valuation-linter.kernel.mjs
 * Valuation Double-Count / Decimal Linter — Robinhood Chain stock tokens.
 * Chainlink feed (8-dec) already includes corporate actions; multiplying by uiMultiplier again
 * double-applies the action. Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-319-rhc-valuation-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'lint_stock_token_valuation',
  mandate_type: 'collateral_mandate',
  gpu:          false,
};

const EPS = 1e-6;

// ---------------------------------------------------------------------------
// scaled_ui lint: Token-2022 ScaledUiAmount, UI string -> raw amount (the inverse direction).
// Mirrors solana-program/token-2022 @ 215cb57af6ae3ef08c4ff5f3f0f14044d062d8ca,
// interface/src/extension/scaled_ui_amount/mod.rs (total_multiplier, try_ui_amount_into_amount):
// parse as f64, divide by multiplier / 10^decimals, reject > u64::MAX / negative / NaN, then
// TRUNCATE toward zero and saturate-cast to u64. The truncating direction is reported as its own
// finding because a rounding implementation lands on a different raw amount.
// InterestBearing (exp path, rounds instead) is deliberately not supported and is refused by name.
// ---------------------------------------------------------------------------
const U64_MAX = 18446744073709551615n;
const TWO_POW_64 = 18446744073709551616; // u64::MAX as f64

// num-traits 0.2.19 pow(10_f64, n): square-and-multiply, bit sequence mirrored.
function pow10f(n) {
  if (n === 0) return 1;
  let base = 10;
  let exp = n;
  while ((exp & 1) === 0) { base = base * base; exp >>= 1; }
  if (exp === 1) return base;
  let acc = base;
  while (exp > 1) {
    exp >>= 1;
    base = base * base;
    if ((exp & 1) === 1) acc = acc * base;
  }
  return acc;
}

// Rust f64::from_str grammar; null on rejection.
function parseRustF64(s) {
  if (typeof s !== 'string') return null;
  const m = /^([+-]?)(?:((?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)|(inf|infinity)|(nan))$/i.exec(s);
  if (!m) return null;
  if (m[2] !== undefined) return Number(m[1] + m[2]);
  if (m[3] !== undefined) return m[1] === '-' ? -Infinity : Infinity;
  return NaN;
}

// A multiplier is a JSON number or, for integer values past 2^53 (not safe I-JSON), a decimal string.
function toMult(v) {
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  if (typeof v === 'string') { const f = parseRustF64(v); return f === null || Number.isNaN(f) ? null : f; }
  return null;
}

function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }

function scaledUiLint(pp, cfg) {
  const ext = cfg.extension ?? pp.extension;
  const named = [ext, pp.mode, pp.interest_bearing_config === undefined ? '' : 'interest'].join(' ');
  if (/interest/i.test(named)) {
    return {
      output_payload: {
        mode: 'scaled_ui',
        verdict: 'REFUSED',
        refusal_reason: 'interest_bearing_not_supported',
        findings: ['interest_bearing_not_supported'],
      },
      compliance_flags: ['RHC_SCALED_UI_REFUSED'],
    };
  }
  const bad = [];
  if (typeof cfg.ui_amount !== 'string') bad.push('invalid_ui_amount');
  if (!(isInt(cfg.decimals) && cfg.decimals >= 0 && cfg.decimals <= 255)) bad.push('invalid_decimals');
  const multF = toMult(cfg.multiplier);
  const newMultF = toMult(cfg.new_multiplier);
  if (multF === null) bad.push('invalid_multiplier');
  if (newMultF === null) bad.push('invalid_new_multiplier');
  if (!isInt(cfg.new_multiplier_effective_timestamp)) bad.push('invalid_effective_timestamp');
  if (!isInt(cfg.unix_timestamp)) bad.push('invalid_unix_timestamp');
  if (cfg.declared_raw_amount !== undefined
      && !(typeof cfg.declared_raw_amount === 'string' && /^[0-9]+$/.test(cfg.declared_raw_amount) && BigInt(cfg.declared_raw_amount) <= U64_MAX)) {
    bad.push('invalid_declared_raw_amount');
  }
  if (bad.length) {
    return {
      output_payload: { mode: 'scaled_ui', verdict: 'INVALID_INPUT', findings: bad },
      compliance_flags: ['RHC_SCALED_UI_INPUT_INVALID'],
    };
  }
  const useNew = cfg.unix_timestamp >= cfg.new_multiplier_effective_timestamp;
  const current = useNew ? newMultF : multF;
  const parsed = parseRustF64(cfg.ui_amount);
  if (parsed === null) {
    return {
      output_payload: {
        mode: 'scaled_ui', verdict: 'FINDINGS', multiplier_in_force: useNew ? 'new_multiplier' : 'multiplier',
        inverse_error: 'InvalidArgument', inverse_reason: 'ui_amount_not_a_float', inverse_raw_amount: null,
        findings: ['inverse_rejected'],
      },
      compliance_flags: ['RHC_SCALED_UI_FINDING'],
    };
  }
  const amount = parsed / (current / pow10f(cfg.decimals));
  if (amount > TWO_POW_64 || amount < 0 || Number.isNaN(amount)) {
    return {
      output_payload: {
        mode: 'scaled_ui', verdict: 'FINDINGS', multiplier_in_force: useNew ? 'new_multiplier' : 'multiplier',
        inverse_error: 'InvalidArgument', inverse_reason: 'amount_out_of_u64_range_or_nan', inverse_raw_amount: null,
        findings: ['inverse_rejected'],
      },
      compliance_flags: ['RHC_SCALED_UI_FINDING'],
    };
  }
  const t = Math.trunc(amount);
  const truncBig = t >= TWO_POW_64 ? U64_MAX : BigInt(t);
  const inverse_raw_amount = truncBig.toString();
  // Round-half-away comparison value (what a rounding implementation would land on).
  const frac = amount - t;
  const roundBig = frac >= 0.5 ? (truncBig === U64_MAX ? U64_MAX : truncBig + 1n) : truncBig;
  const findings = [];
  if (roundBig !== truncBig) findings.push('trunc_direction_differs_from_round');
  if (t >= TWO_POW_64) findings.push('saturated_at_u64_max');
  if (cfg.declared_raw_amount !== undefined && cfg.declared_raw_amount !== inverse_raw_amount) findings.push('declared_raw_amount_mismatch');
  return {
    output_payload: {
      mode: 'scaled_ui',
      verdict: findings.length === 0 ? 'CONSISTENT' : 'FINDINGS',
      multiplier_in_force: useNew ? 'new_multiplier' : 'multiplier',
      inverse_raw_amount,
      round_raw_amount: roundBig.toString(),
      findings,
    },
    compliance_flags: findings.length === 0 ? ['RHC_SCALED_UI_CONSISTENT'] : ['RHC_SCALED_UI_FINDING'],
  };
}

export function compute(pp) {
  if (pp && typeof pp === 'object' && (pp.scaled_ui !== undefined || pp.mode === 'scaled_ui' || pp.extension !== undefined || pp.interest_bearing_config !== undefined)) {
    const cfg = (pp.scaled_ui && typeof pp.scaled_ui === 'object') ? pp.scaled_ui : {};
    return scaledUiLint(pp, cfg);
  }
  const {
    raw_balance,
    chainlink_price_usd,
    ui_multiplier,
    computed_usd_value_under_test,
    applied_multiplier_in_expression,
  } = pp;

  const finite = [raw_balance, chainlink_price_usd, ui_multiplier, computed_usd_value_under_test]
    .every(v => typeof v === 'number' && Number.isFinite(v));

  if (!finite) {
    const output_payload = {
      verdict: 'MISMATCH_UNEXPLAINED',
      reason: 'non_finite_or_missing_input',
      correct_value: null,
      double_counted_value: null,
      delta: null,
      corrected_expression: 'raw_balance * chainlink_price_usd',
    };
    return { output_payload, compliance_flags: ['RHC_VALUATION_INPUT_INVALID'] };
  }

  const correct_value = raw_balance * chainlink_price_usd;
  const double_counted_value = raw_balance * chainlink_price_usd * ui_multiplier;

  const matchesCorrect = Math.abs(computed_usd_value_under_test - correct_value) < EPS * Math.max(1, Math.abs(correct_value));
  const matchesDoubleCounted = Math.abs(computed_usd_value_under_test - double_counted_value) < EPS * Math.max(1, Math.abs(double_counted_value));

  let verdict;
  let discrepancy = null;
  if (matchesCorrect) {
    verdict = 'CLEAN';
  } else if (matchesDoubleCounted || applied_multiplier_in_expression === true) {
    verdict = 'DOUBLE_COUNT_DETECTED';
    discrepancy = 'valuation_expression_reapplies_ui_multiplier_already_priced_in_by_chainlink_feed';
  } else {
    verdict = 'MISMATCH_UNEXPLAINED';
    discrepancy = 'computed_value_matches_neither_correct_nor_double_counted_expression';
  }

  const delta = computed_usd_value_under_test - correct_value;

  const output_payload = {
    verdict,
    correct_value,
    double_counted_value,
    computed_usd_value_under_test,
    delta,
    discrepancy,
    corrected_expression: 'raw_balance * chainlink_price_usd  (do not multiply by uiMultiplier — the feed already reflects it)',
  };

  const compliance_flags = verdict === 'CLEAN' ? ['RHC_VALUATION_CLEAN'] : ['RHC_VALUATION_DOUBLE_COUNT'];
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

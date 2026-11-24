/**
 * art-317-rhc-multiplier-reconciler.kernel.mjs
 * ERC-8056 Multiplier Reconciler — Robinhood Chain stock-token corporate actions.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-317-rhc-multiplier-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'reconcile_erc8056_multiplier',
  mandate_type: 'collateral_mandate',
  gpu:          false,
};

const EPS = 1e-9;

// ---------------------------------------------------------------------------
// scaled_ui mode: Token-2022 ScaledUiAmount, raw amount -> UI string.
// Mirrors solana-program/token-2022 @ 215cb57af6ae3ef08c4ff5f3f0f14044d062d8ca,
// interface/src/extension/scaled_ui_amount/mod.rs (current_multiplier, amount_to_ui_amount)
// and the shared trim_ui_amount_string. IEEE-754 f64 arithmetic is bit-identical to Rust's;
// the UI string is built by an exact fixed-point formatter (no toFixed / toString, which switch
// to exponential notation from 1e21 where Rust's formatter never does).
// InterestBearing (exp path) is deliberately not supported and is refused by name.
// ---------------------------------------------------------------------------
const U64_MAX = 18446744073709551615n;

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

// Exact decimal expansion of a finite f64 with `decimals` fraction digits, ties to even
// (Rust's float formatter). BigInt only; no library.
function fixedExact(x, decimals) {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const bits = dv.getBigUint64(0);
  const neg = (bits >> 63n) === 1n;
  const be = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  let m, e;
  if (be === 0) { m = frac; e = -1074; } else { m = frac | (1n << 52n); e = be - 1075; }
  const p10 = 10n ** BigInt(decimals);
  let q;
  if (e >= 0) {
    q = (m << BigInt(e)) * p10;
  } else {
    const k = BigInt(-e);
    const num = m * p10;
    q = num >> k;
    const r = num - (q << k);
    const half = 1n << (k - 1n);
    if (r > half || (r === half && (q & 1n) === 1n)) q += 1n;
  }
  let s = q.toString();
  if (decimals > 0) {
    if (s.length <= decimals) s = '0'.repeat(decimals - s.length + 1) + s;
    s = s.slice(0, s.length - decimals) + '.' + s.slice(s.length - decimals);
  }
  return (neg ? '-' : '') + s;
}

function trimUiAmount(s, decimals) {
  if (decimals > 0) {
    let end = s.length;
    while (end > 0 && s[end - 1] === '0') end--;
    while (end > 0 && s[end - 1] === '.') end--;
    return s.slice(0, end);
  }
  return s;
}

function parseRustF64(s) {
  const m = /^([+-]?)(?:((?:[0-9]+.?[0-9]*|.[0-9]+)(?:[eE][+-]?[0-9]+)?)|(inf|infinity)|(nan))$/i.exec(s);
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

function scaledUiMode(pp, cfg) {
  const ext = cfg.extension ?? pp.extension;
  const named = [ext, pp.mode, pp.interest_bearing_config === undefined ? '' : 'interest'].join(' ');
  if (/interest/i.test(named)) {
    return {
      output_payload: {
        mode: 'scaled_ui',
        verdict: 'REFUSED',
        refusal_reason: 'interest_bearing_not_supported',
        discrepancies: ['interest_bearing_not_supported'],
      },
      compliance_flags: ['RHC_SCALED_UI_REFUSED'],
    };
  }
  const bad = [];
  const rawOk = typeof cfg.raw_amount === 'string' && /^[0-9]+$/.test(cfg.raw_amount) && BigInt(cfg.raw_amount) <= U64_MAX;
  if (!rawOk) bad.push('invalid_raw_amount');
  if (!(isInt(cfg.decimals) && cfg.decimals >= 0 && cfg.decimals <= 255)) bad.push('invalid_decimals');
  const multF = toMult(cfg.multiplier);
  const newMultF = toMult(cfg.new_multiplier);
  if (multF === null) bad.push('invalid_multiplier');
  if (newMultF === null) bad.push('invalid_new_multiplier');
  if (!isInt(cfg.new_multiplier_effective_timestamp)) bad.push('invalid_effective_timestamp');
  if (!isInt(cfg.unix_timestamp)) bad.push('invalid_unix_timestamp');
  if (typeof cfg.declared_ui_amount !== 'string') bad.push('invalid_declared_ui_amount');
  if (bad.length) {
    return {
      output_payload: { mode: 'scaled_ui', verdict: 'INVALID_INPUT', discrepancies: bad },
      compliance_flags: ['RHC_SCALED_UI_INPUT_INVALID'],
    };
  }
  const useNew = cfg.unix_timestamp >= cfg.new_multiplier_effective_timestamp;
  const effective = useNew ? newMultF : multF;
  const effectiveEcho = useNew ? cfg.new_multiplier : cfg.multiplier;
  const scaled = Number(BigInt(cfg.raw_amount)) * effective;
  const truncated = Math.trunc(scaled) / pow10f(cfg.decimals);
  const computed_ui_amount = trimUiAmount(fixedExact(truncated, cfg.decimals), cfg.decimals);
  const ui_amount_match = computed_ui_amount === cfg.declared_ui_amount;
  const discrepancies = ui_amount_match ? [] : ['ui_amount_mismatch'];
  return {
    output_payload: {
      mode: 'scaled_ui',
      verdict: ui_amount_match ? 'RECONCILED' : 'DISCREPANCY',
      multiplier_in_force: useNew ? 'new_multiplier' : 'multiplier',
      effective_multiplier: effectiveEcho,
      computed_ui_amount,
      declared_ui_amount: cfg.declared_ui_amount,
      ui_amount_match,
      discrepancies,
    },
    compliance_flags: ui_amount_match ? ['RHC_SCALED_UI_RECONCILED'] : ['RHC_SCALED_UI_DISCREPANCY'],
  };
}

export function compute(pp) {
  if (pp && typeof pp === 'object' && (pp.scaled_ui !== undefined || pp.mode === 'scaled_ui' || pp.extension !== undefined || pp.interest_bearing_config !== undefined)) {
    const cfg = (pp.scaled_ui && typeof pp.scaled_ui === 'object') ? pp.scaled_ui : {};
    return scaledUiMode(pp, cfg);
  }
  const {
    declared_action = {},
    prior_multiplier,
    current_multiplier,
    raw_balance_before,
    raw_balance_after,
    event_log = [],
  } = pp;

  const discrepancies = [];

  // 1. ratio match
  let computed_ratio = null;
  let expected_ratio = typeof declared_action.ratio === 'number' ? declared_action.ratio : null;
  if (typeof prior_multiplier === 'number' && prior_multiplier > 0 && typeof current_multiplier === 'number') {
    computed_ratio = current_multiplier / prior_multiplier;
  } else {
    discrepancies.push('invalid_prior_multiplier');
  }
  let ratio_match = false;
  if (computed_ratio !== null && expected_ratio !== null) {
    ratio_match = Math.abs(computed_ratio - expected_ratio) < EPS;
    if (!ratio_match) discrepancies.push('multiplier_ratio_mismatch');
  } else if (expected_ratio === null) {
    discrepancies.push('missing_declared_ratio');
  }

  // 2. event log: no missed / no duplicate application
  const seenDates = new Set();
  let duplicate_events = false;
  for (const ev of event_log) {
    if (ev && ev.ex_date) {
      if (seenDates.has(ev.ex_date)) duplicate_events = true;
      seenDates.add(ev.ex_date);
    }
  }
  if (duplicate_events) discrepancies.push('duplicate_event_application');
  const missed_application = event_log.length === 0;
  if (missed_application) discrepancies.push('no_event_log_entry');

  // 3. monotonic sequence against ex-dates
  let monotonic = true;
  for (let i = 1; i < event_log.length; i++) {
    const prev = event_log[i - 1]?.ex_date;
    const cur = event_log[i]?.ex_date;
    if (prev && cur && String(cur) < String(prev)) { monotonic = false; break; }
  }
  if (!monotonic) discrepancies.push('non_monotonic_event_sequence');
  if (event_log.length && declared_action.ex_date) {
    const last = event_log[event_log.length - 1]?.ex_date;
    if (last && last !== declared_action.ex_date) discrepancies.push('declared_ex_date_not_in_event_log');
  }

  // 4. raw balance invariance — raw balances stay static until redemption
  let raw_balance_invariant = null;
  if (typeof raw_balance_before === 'number' && typeof raw_balance_after === 'number') {
    raw_balance_invariant = raw_balance_before === raw_balance_after;
    if (!raw_balance_invariant) discrepancies.push('raw_balance_moved_without_redemption');
  }

  const verdict = discrepancies.length === 0 ? 'RECONCILED' : 'DISCREPANCY';

  const output_payload = {
    verdict,
    declared_action_type: declared_action.type ?? null,
    expected_ratio,
    computed_ratio,
    ratio_match,
    raw_balance_invariant,
    event_count: event_log.length,
    discrepancies,
  };

  const compliance_flags = verdict === 'RECONCILED' ? ['RHC_MULTIPLIER_RECONCILED'] : ['RHC_MULTIPLIER_DISCREPANCY'];

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

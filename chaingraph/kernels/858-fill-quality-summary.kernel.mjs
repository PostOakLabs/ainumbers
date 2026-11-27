import { executionHash } from './_hash.mjs';

// 858-fill-quality-summary: summarise ONE order's fill quality from caller-declared fills,
// in exact integer arithmetic (BigInt). Every numeric input and output is a string; there is
// no Number() on caller input anywhere in the money path.
//
// Computes: filled quantity, fill rate, volume-weighted average price (VWAP) with its exact
// integer residual, participation against a caller-declared market volume, auction fill share,
// cancel ratio, and orders-placed / fills-count ratio. Computes NO arrival shortfall and NO
// opportunity cost, fetches no market data, and is not a best-execution determination.
//
// NULL: an explicit null is treated exactly like an absent field (R4 null-class ratchet): a
// required field then refuses as MISSING, and an absent or null price_decimals takes the
// currency default. A wrong type or a malformed value always refuses by field name.
//
// DETERMINISM: compute() is a pure function of pp. No Date, no Math.random, no network, no
// filesystem, no TextEncoder/atob/btoa/URL (absent in the QuickJS-ng zkVM guest).

const TOOL_ID = '858-fill-quality-summary';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'summarize_fill_quality',
  mandate_type: 'compliance_control', gpu: false,
};

// ISO 4217 minor-unit exponents (ISO 4217 amendment tables). Closed table; the exponent is
// derived from the code and is never accepted as input.
const CURRENCY_EXPONENT = new Map([
  ['USD', 2], ['EUR', 2], ['GBP', 2], ['CHF', 2], ['JPY', 0],
  ['BHD', 3], ['KWD', 3], ['OMR', 3], ['TND', 3], ['JOD', 3], ['IQD', 3], ['LYD', 3],
]);

const MAX_FILLS = 5000;
const MAX_DIGITS = 30;
const UINT_RE = /^(0|[1-9][0-9]*)$/;

/** Parse a non-negative integer string (no sign, no leading zeros, bounded length), else null. */
function parseUint(v) {
  if (typeof v !== 'string') return null;
  if (v.length === 0 || v.length > MAX_DIGITS) return null;
  if (!UINT_RE.test(v)) return null;
  return BigInt(v);
}

/** Integer division of non-negative n by positive d, rounded half away from zero. */
function rdiv(n, d) {
  return (2n * n + d) / (2n * d);
}

/** Scaled-by-100 non-negative integer to a string with exactly 2 decimals. */
function fmt2(x) {
  const whole = x / 100n;
  const frac = x % 100n;
  return whole.toString() + '.' + (frac < 10n ? '0' : '') + frac.toString();
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function refusal(domain_errors) {
  const compliance_flags = ['INPUT_REFUSED'];
  const warnings = compliance_flags.slice();
  return {
    output_payload: { refused: true, domain_errors, warnings },
    compliance_flags,
  };
}

/**
 * compute(pp) — pure decision kernel. Never throws on junk input: every defect becomes a
 * named entry in domain_errors, and on any refusal no figure is computed.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  if (!isPlainObject(pp)) return refusal([{ field: 'policy_parameters', code: 'NOT_AN_OBJECT' }]);
  const errors = [];
  const bad = (field, code) => { errors.push({ field, code }); };

  // order_side: exact lowercase enum.
  const side = pp.order_side;
  if (side == null) bad('order_side', 'MISSING');
  else if (side !== 'buy' && side !== 'sell') bad('order_side', 'NOT_ALLOWED');

  // order_target_qty: integer string > 0.
  let target = null;
  if (pp.order_target_qty == null) bad('order_target_qty', 'MISSING');
  else {
    target = parseUint(pp.order_target_qty);
    if (target === null) bad('order_target_qty', 'NOT_AN_INTEGER_STRING');
    else if (target <= 0n) { bad('order_target_qty', 'NOT_POSITIVE'); target = null; }
  }

  // currency: closed ISO 4217 table; exponent derived.
  let currency = null;
  let exponent = null;
  if (pp.currency == null) bad('currency', 'MISSING');
  else if (typeof pp.currency !== 'string' || !CURRENCY_EXPONENT.has(pp.currency)) bad('currency', 'UNKNOWN_CURRENCY');
  else { currency = pp.currency; exponent = CURRENCY_EXPONENT.get(currency); }

  // price_decimals: optional single digit string 0..8; default is the currency exponent.
  let priceDecimals = exponent;
  if (pp.price_decimals != null) {
    if (typeof pp.price_decimals === 'string' && /^[0-8]$/.test(pp.price_decimals)) priceDecimals = Number.parseInt(pp.price_decimals, 10);
    else { bad('price_decimals', 'OUT_OF_RANGE_0_TO_8'); priceDecimals = null; }
  }

  // market volume and its window label.
  let market = null;
  if (pp.market_volume_shares == null) bad('market_volume_shares', 'MISSING');
  else {
    market = parseUint(pp.market_volume_shares);
    if (market === null) bad('market_volume_shares', 'NOT_AN_INTEGER_STRING');
    else if (market <= 0n) { bad('market_volume_shares', 'NOT_POSITIVE'); market = null; }
  }
  const windowLabel = pp.market_volume_window;
  if (windowLabel == null) bad('market_volume_window', 'MISSING');
  else if (typeof windowLabel !== 'string' || windowLabel.length === 0) bad('market_volume_window', 'NOT_A_NON_EMPTY_STRING');

  // fills[]
  let fillCount = 0;
  let filled = 0n;
  let auctionQty = 0n;
  let pqSum = 0n;
  let fillsOk = false;
  const fills = pp.fills;
  if (fills == null) bad('fills', 'MISSING');
  else if (!Array.isArray(fills)) bad('fills', 'NOT_AN_ARRAY');
  else if (fills.length === 0) bad('fills', 'EMPTY');
  else if (fills.length > MAX_FILLS) bad('fills', 'TOO_MANY');
  else {
    const before = errors.length;
    const seen = new Set();
    for (let i = 0; i < fills.length; i++) {
      const f = fills[i];
      const at = 'fills[' + i + ']';
      if (!isPlainObject(f)) { bad(at, 'NOT_AN_OBJECT'); continue; }
      if (typeof f.fill_id !== 'string' || f.fill_id.length === 0) bad(at + '.fill_id', 'NOT_A_NON_EMPTY_STRING');
      else if (seen.has(f.fill_id)) bad(at + '.fill_id', 'DUPLICATE');
      else seen.add(f.fill_id);
      if (side === 'buy' || side === 'sell') {
        if (f.side !== side) bad(at + '.side', 'SIDE_MISMATCH');
      } else if (f.side !== 'buy' && f.side !== 'sell') bad(at + '.side', 'NOT_ALLOWED');
      if (currency !== null) {
        if (f.currency !== currency) bad(at + '.currency', 'CURRENCY_MISMATCH');
      } else if (typeof f.currency !== 'string') bad(at + '.currency', 'NOT_A_STRING');
      const price = parseUint(f.price);
      if (price === null) bad(at + '.price', 'NOT_AN_INTEGER_STRING');
      else if (price <= 0n) bad(at + '.price', 'NOT_POSITIVE');
      const qty = parseUint(f.quantity_shares);
      if (qty === null) bad(at + '.quantity_shares', 'NOT_AN_INTEGER_STRING');
      else if (qty <= 0n) bad(at + '.quantity_shares', 'NOT_POSITIVE');
      if (f.venue_type == null) bad(at + '.venue_type', 'MISSING');
      else if (f.venue_type !== 'auction' && f.venue_type !== 'continuous') bad(at + '.venue_type', 'NOT_ALLOWED');
      if (price !== null && price > 0n && qty !== null && qty > 0n && (f.venue_type === 'auction' || f.venue_type === 'continuous')) {
        filled += qty;
        pqSum += price * qty;
        if (f.venue_type === 'auction') auctionQty += qty;
      }
    }
    fillCount = fills.length;
    fillsOk = errors.length === before;
  }

  // orders_placed and cancels.
  let orders = null;
  if (pp.orders_placed == null) bad('orders_placed', 'MISSING');
  else {
    orders = parseUint(pp.orders_placed);
    if (orders === null) bad('orders_placed', 'NOT_AN_INTEGER_STRING');
    else if (fillCount > 0 && orders < BigInt(fillCount)) { bad('orders_placed', 'BELOW_FILLS_COUNT'); orders = null; }
  }
  let cancels = null;
  if (pp.cancels == null) bad('cancels', 'MISSING');
  else {
    cancels = parseUint(pp.cancels);
    if (cancels === null) bad('cancels', 'NOT_AN_INTEGER_STRING');
    else if (orders !== null && cancels > orders) { bad('cancels', 'ABOVE_ORDERS_PLACED'); cancels = null; }
  }

  // Cross-field refusals, only once the fills themselves are clean.
  if (fillsOk) {
    if (target !== null && filled > target) {
      bad('filled_qty', 'ABOVE_ORDER_TARGET');
      bad('order_target_qty', 'BELOW_FILLED_QTY');
    }
    if (market !== null && filled > market) {
      bad('filled_qty', 'ABOVE_MARKET_VOLUME');
      bad('market_volume_shares', 'BELOW_FILLED_QTY');
    }
  }

  if (errors.length > 0 || !fillsOk) return refusal(errors);

  // Every input is valid: compute. (target, market, orders, cancels, priceDecimals are non-null.)
  const vwap = rdiv(pqSum, filled);
  const residual = pqSum - vwap * filled;
  const complete = filled === target;
  const compliance_flags = [];
  if (!complete) compliance_flags.push('ORDER_INCOMPLETE');
  const warnings = compliance_flags.slice();

  return {
    output_payload: {
      refused: false,
      order_side: side,
      currency,
      minor_unit_exponent: String(exponent),
      price_decimals: String(priceDecimals),
      market_volume_window: windowLabel,
      fills_count: String(fillCount),
      filled_qty: filled.toString(),
      unfilled_qty: (target - filled).toString(),
      order_complete: complete ? 'true' : 'false',
      fill_rate_pct: fmt2(rdiv(filled * 10000n, target)),
      price_quantity_sum: pqSum.toString(),
      vwap_price: vwap.toString(),
      vwap_residual: residual.toString(),
      participation_pct: fmt2(rdiv(filled * 10000n, market)),
      auction_fill_share_pct: fmt2(rdiv(auctionQty * 10000n, filled)),
      cancel_ratio: fmt2(rdiv(cancels * 100n, orders)),
      order_to_trade_ratio: fmt2(rdiv(orders * 100n, BigInt(fillCount))),
      domain_errors: [],
      warnings,
    },
    compliance_flags,
  };
}

// Never-throw hash guard: mirrors the _hash.mjs canonicalizer limits (depth 512, 1e6
// values, finite safe numbers, no BigInt) so an unhashable input is refused with a null
// execution_hash and a named hash_refusal, never thrown out of buildArtifact ('Do not
// know how to serialize a BigInt'). Keep the walk in the kernel file, wired through
// buildArtifact exactly as below.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  // Walk the caller input first so compute() never sees an unhashable value, then walk
  // the {policy_parameters, output_payload} pair that executionHash() will canonicalize.
  let unhashable = findHashRefusal(pp, 'policy_parameters', 2, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const result = unhashable === null ? compute(pp) : null;
  const output_payload = result === null ? null : result.output_payload;
  const compliance_flags = result === null ? ['INPUT_UNHASHABLE_REFUSED'] : result.compliance_flags;
  if (unhashable === null) {
    unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'artifact', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  }
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
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
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}

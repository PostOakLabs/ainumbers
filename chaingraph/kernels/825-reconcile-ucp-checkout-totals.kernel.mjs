import { executionHash } from './_hash.mjs';

// 825-reconcile-ucp-checkout-totals — recompute a pasted UCP cart, checkout or order totals
// block in integer minor units and return RECONCILED, MISMATCH or INDETERMINATE.
//
// Verify-only: the caller pastes the document; the kernel makes no network call, never fetches
// /.well-known/ucp, never fetches a key and never calls a merchant endpoint.
//
// NORMATIVE BASIS (all pinned in the node's cited_clause_digest, UCP tag v2026-08-25):
//   - amounts are ISO 4217 minor units, integers within +/-9007199254740991 (= 2^53-1)
//     (common/types/amount.json, signed_amount.json);
//   - the totals breakdown MUST hold exactly one subtotal and one total entry; detail types
//     (tax, fee, discount, fulfillment) may repeat; non-canonical types require display_text
//     (common/types/totals.json);
//   - discount and items_discount amounts are strictly negative; subtotal, fulfillment, tax
//     and fee are zero or positive; the `total` entry is unbounded (negative totals pass
//     schema, issue #1025) (common/types/total.json);
//   - quantity is an integer step count of 10^-scale of the sale-basis unit, scale 0..15,
//     C62 exactly 0; item.price is per one WHOLE sale-basis unit (common/types/unit.json,
//     quantity_unit.json, shopping/types/item.json);
//   - item.unit_price marks a pricing basis different from the sale basis; the Business
//     rounds the comparator ONCE to minor units per its own pricing rules, so the
//     price-per-step identity this node checks is not protocol-asserted on such lines
//     (shopping/types/unit_price.json);
//   - order adjustments carry signed totals, negative for money returned to the buyer
//     (shopping/types/adjustment.json); net refunded MUST NOT exceed the paid total;
//   - discount attribution to a code exists on cart/checkout via the dev.ucp.shopping.discount
//     extension (applied_discount[].code, omitted for automatic discounts) and is NOT carried
//     on the durable order record (shopping/discount.json, issue #1026).
//
// ARITHMETIC: pure integer. price x quantity is computed as an exact base-10 digit-array
// product (16x16 schoolbook digits, every partial <= 81) and divided by 10^scale by digit
// shift, so the 32-digit intermediate never passes through a float; sums and differences use
// base-10^7 limb add/sub with carries. No float arithmetic, no Date, no BigInt, no
// TextEncoder anywhere in the guest path. The rounding rule is a declared policy parameter
// (default half_even) applied at most once per line, and the output names the rule applied.
//
// REFUSALS: structural malformation (totals not an array or without exactly one subtotal and
// one total, an entry missing type or amount, a non-integer amount, invalid scale, invalid
// rounding policy) refuses the whole call with compliance_flags ['INPUT_REFUSED'] — partial
// reconciliation over a malformed document could misstate the totals. Value-level findings
// (sign violations, identity mismatches, out-of-range amounts, unknown total types) are
// reported per entry and drive MISMATCH/INDETERMINATE.

const TOOL_ID = '825-reconcile-ucp-checkout-totals';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_ucp_checkout_totals',
  mandate_type: 'compliance_control', gpu: false,
};

// Resource bounds. Anything over a bound returns INDETERMINATE, never a guess.
const MAX_NODES = 20000;        // JSON nodes across the pasted document
const MAX_DEPTH = 64;           // JSON nesting depth
const MAX_LINES = 500;          // line_items
const MAX_TOTAL_ENTRIES = 100;  // entries in one totals array
const MAX_ADJUSTMENTS = 200;    // order adjustments
const MAX_STR = 4096;           // characters in one string value we keep

const MAX_MINOR = 9007199254740991;   // 2^53-1, UCP amount bound
const CANONICAL_TYPES = ['subtotal', 'items_discount', 'discount', 'fulfillment', 'tax', 'fee', 'total'];
const NONNEG_TYPES = ['subtotal', 'fulfillment', 'tax', 'fee'];
const NEG_TYPES = ['discount', 'items_discount'];
const ROUNDING_POLICIES = ['half_even', 'half_up', 'half_down', 'floor', 'ceil'];
const LIMB = 10000000; // base 1e7 for exact add/sub of many amount-sized terms
const POW10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000,
  10000000000, 100000000000, 1000000000000, 10000000000000, 100000000000000, 1000000000000000];

const SPEC_BASIS = 'UCP 2026-08-25 schemas (tag v2026-08-25 of github.com/Universal-Commerce-Protocol/ucp, Apache-2.0): common/types/totals.json + total.json + amount.json + signed_amount.json, common/types/unit.json + quantity_unit.json, shopping/types/item.json + unit_price.json + adjustment.json, shopping/discount.json; issues #1025 (negative total) and #1026 (order discount attribution)';
const SCOPE_NOTE = 'Arithmetic-consistency reconcile only: the node recomputes identities (price x quantity steps / 10^scale, line-subtotal roll-up, totals breakdown sum, refund bound) and checks the schema sign rules; it never judges whether a tax, fee or discount AMOUNT itself was computed correctly, because UCP publishes no tax or rounding algorithm. At most one rounding happens per line, under the caller-declared policy (default half_even), and the output names the rule applied.';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => typeof v === 'number' && isFinite(v) && Math.floor(v) === v;

// ── exact integer arithmetic (base-10 digits for multiply, base-1e7 limbs for add/sub) ────────

// a: non-negative integer <= MAX_MINOR. Returns base-10 digit array, LSB first, exact.
function digitsOf(a) {
  const d = [];
  let v = a;
  while (v > 0) { d.push(v % 10); v = (v - (v % 10)) / 10; }
  return d.length ? d : [0];
}
// Exact product as base-10 digits (LSB first). Every partial product is <= 81.
function mulDigits(a, b) {
  const da = digitsOf(a), db = digitsOf(b);
  const out = new Array(da.length + db.length).fill(0);
  for (let i = 0; i < da.length; i++) {
    for (let j = 0; j < db.length; j++) out[i + j] += da[i] * db[j];
  }
  let carry = 0;
  for (let k = 0; k < out.length; k++) {
    const t = out[k] + carry;
    out[k] = t % 10;
    carry = (t - (t % 10)) / 10;
  }
  while (carry > 0) { out.push(carry % 10); carry = (carry - (carry % 10)) / 10; }
  return out;
}
// Base-10 digits -> base-1e7 limbs (LSB first), exact.
function limbsFromDigits(d) {
  const limbs = [];
  for (let i = 0; i < d.length; i += 7) {
    let limb = 0, mul = 1;
    for (let j = 0; j < 7 && i + j < d.length; j++) { limb += d[i + j] * mul; mul *= 10; }
    limbs.push(limb);
  }
  return limbs;
}
function addLimbs(a, b) { // exact, magnitudes only
  const n = Math.max(a.length, b.length), out = new Array(n).fill(0);
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const t = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0) + carry;
    out[i] = t % LIMB;
    carry = (t - (t % LIMB)) / LIMB;
  }
  while (carry > 0) { out.push(carry % LIMB); carry = (carry - (carry % LIMB)) / LIMB; }
  return out;
}
function subLimbs(a, b) { // exact, requires a >= b
  const out = a.slice();
  let borrow = 0;
  for (let i = 0; i < out.length; i++) {
    const t = out[i] - (i < b.length ? b[i] : 0) - borrow;
    if (t < 0) { out[i] = t + LIMB; borrow = 1; } else { out[i] = t; borrow = 0; }
  }
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}
function cmpLimbs(a, b) {
  if (a.length !== b.length) return a.length > b.length ? 1 : -1;
  for (let i = a.length - 1; i >= 0; i--) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
function limbsValue(l) { // only for values known to fit <= MAX_MINOR
  let v = 0;
  for (let i = l.length - 1; i >= 0; i--) v = v * LIMB + l[i];
  return v;
}
// Signed exact sum of integers (each within +/-MAX_MINOR). Returns { neg, mag, fits } where
// mag is limbs of the absolute value; fits says whether the magnitude is <= MAX_MINOR.
function exactSum(nums) {
  let pos = [0], neg = [0];
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i];
    const d = limbsFromDigits(digitsOf(Math.abs(v)));
    if (v >= 0) pos = addLimbs(pos, d);
    else neg = addLimbs(neg, d);
  }
  const c = cmpLimbs(pos, neg);
  const mag = c >= 0 ? subLimbs(pos, neg) : subLimbs(neg, pos);
  return { neg: c < 0, mag, fits: mag.length <= 3 && (mag.length < 3 || cmpLimbs(mag, [8151873, 4343412, 194]) <= 0) };
}
// price * quantity / 10^scale exactly: { quotient, remainder, overflow }.
// quantity <= MAX_MINOR, scale <= 15. Partials stay <= 81 so the product is exact.
function priceTimesSteps(price, quantity, scale) {
  const prod = mulDigits(price, quantity); // LSB first, base 10
  let rem = 0, mul = 1;
  for (let i = 0; i < scale; i++) { rem += (prod[i] || 0) * mul; mul *= 10; } // < 10^15 < 2^53
  const qDigits = prod.slice(scale);
  while (qDigits.length > 0 && qDigits[qDigits.length - 1] === 0) qDigits.pop();
  if (qDigits.length > 16) return { overflow: true, quotient: 0, remainder: 0 };
  let q = 0;
  for (let i = qDigits.length - 1; i >= 0; i--) q = q * 10 + qDigits[i]; // exact at <= 16 digits
  if (q > MAX_MINOR) return { overflow: true, quotient: 0, remainder: 0 };
  return { overflow: false, quotient: q, remainder: rem };
}
// Apply the declared rounding policy to quotient + remainder; returns the increment 0/1.
function roundingIncrement(quotient, remainder, den, policy) {
  if (remainder === 0) return 0;
  const twice = remainder * 2; // < 2*10^15 < 2^53
  if (policy === 'floor') return 0;
  if (policy === 'ceil') return 1;
  if (policy === 'half_up') return twice >= den ? 1 : 0;
  if (policy === 'half_down') return twice > den ? 1 : 0;
  // half_even (default): to the even neighbour on an exact tie
  return twice > den ? 1 : (twice < den ? 0 : (quotient % 2 === 0 ? 0 : 1));
}

// Iterative size/depth walk so a hostile input cannot blow the stack or the budget.
function measure(root, budget) {
  const stack = [[root, 1]];
  while (stack.length) {
    const cell = stack.pop();
    const v = cell[0], d = cell[1];
    budget.nodes++;
    if (budget.nodes > MAX_NODES) return 'INPUT_BOUND_EXCEEDED';
    if (d > MAX_DEPTH) return 'DEPTH_EXCEEDED';
    if (typeof v === 'string' && v.length > MAX_STR) return 'INPUT_BOUND_EXCEEDED';
    if (v !== null && typeof v === 'object') {
      const kids = Array.isArray(v) ? v : Object.keys(v).map((k) => v[k]);
      for (let i = 0; i < kids.length; i++) stack.push([kids[i], d + 1]);
    }
  }
  return null;
}

function result(payload, refused) {
  const flags = refused ? ['INPUT_REFUSED'] : [];
  // Flag-mirror doctrine: warnings is truthy exactly when compliance_flags is non-empty.
  return { output_payload: Object.assign({}, payload, { warnings: flags.slice() }), compliance_flags: flags };
}
function shell(verdict, extra) {
  return Object.assign({
    verdict,
    mode: null,
    currency: null,
    rounding_applied: null,
    rounding_exercised: false,
    totals_identity_ok: null,
    declared_total: null,
    computed_total: null,
    line_count: 0,
    line_results: [],
    violations: [],
    skipped: [],
    indeterminate: [],
    negative_total: false,
    discount_attribution: null,
    refunds: null,
    evaluated_count: 0,
    skipped_count: 0,
    truncated: false,
    refusal: null,
    notes: [],
    spec_basis: SPEC_BASIS,
    scope_note: SCOPE_NOTE,
  }, extra || {});
}

// One totals-array entry: validate structure, return a workable record or a refusal code.
function readTotalEntry(entry, path, violations) {
  if (!isObj(entry)) return { refuse: 'ENTRY_NOT_OBJECT' };
  if (!hasOwn(entry, 'type') || typeof entry.type !== 'string' || entry.type.length === 0 || entry.type.length > MAX_STR) return { refuse: 'ENTRY_TYPE_MISSING' };
  if (!hasOwn(entry, 'amount')) return { refuse: 'ENTRY_AMOUNT_MISSING' };
  const a = entry.amount;
  if (!isInt(a)) return { refuse: 'AMOUNT_NOT_INTEGER' };
  const out = { path, type: entry.type, amount: a, known: CANONICAL_TYPES.indexOf(entry.type) !== -1 };
  if (a > MAX_MINOR || a < -MAX_MINOR) {
    violations.push({ path: path + '.amount', code: 'AMOUNT_OUT_OF_RANGE', reason: 'amount is an integer but outside the UCP bound of +/- 2^53-1 minor units (amount.json / signed_amount.json)' });
    out.out_of_range = true;
  } else if (NEG_TYPES.indexOf(entry.type) !== -1 && a >= 0) {
    violations.push({ path: path + '.amount', code: 'SIGN_VIOLATION', reason: entry.type + ' entries MUST be strictly negative (total.json: exclusiveMaximum 0)' });
    out.sign_violation = true;
  } else if (NONNEG_TYPES.indexOf(entry.type) !== -1 && a < 0) {
    violations.push({ path: path + '.amount', code: 'SIGN_VIOLATION', reason: entry.type + ' entries MUST be zero or positive (total.json: minimum 0)' });
    out.sign_violation = true;
  }
  return out;
}

// Reconcile one totals array against its own total entry (document and adjustment level).
// strictCardinality: refuse when the exactly-one-subtotal/one-total rule fails (document
// level). Otherwise report indeterminate and skip the identity (adjustment level).
function reconcileTotalsArray(entries, pathPrefix, violations, indeterminate, out, strictCardinality) {
  let count = 0, anyOutOfRange = false;
  let subtotalCount = 0, totalCount = 0;
  let subtotalEntry = null, totalEntry = null;
  const known = [], unknownTypes = [];
  for (let i = 0; i < entries.length; i++) {
    if (count >= MAX_TOTAL_ENTRIES) { out.truncated = true; break; }
    const rec = readTotalEntry(entries[i], pathPrefix + '[' + i + ']', violations);
    if (rec.refuse) return { refuse: rec.refuse };
    count++;
    if (rec.type === 'subtotal') { subtotalCount++; subtotalEntry = rec; }
    else if (rec.type === 'total') { totalCount++; totalEntry = rec; }
    if (rec.out_of_range) anyOutOfRange = true;
    if (rec.known && rec.type !== 'total' && !rec.out_of_range) known.push(rec.amount);
    if (!rec.known && unknownTypes.indexOf(rec.type) === -1) unknownTypes.push(rec.type);
  }
  out.declared_total = totalEntry ? totalEntry.amount : null;
  out.negative_total = totalEntry ? totalEntry.amount < 0 : false;
  if (subtotalCount !== 1 || totalCount !== 1) {
    if (strictCardinality) return { refuse: 'TOTALS_CARDINALITY' };
    indeterminate.push({ code: 'TOTALS_CARDINALITY', reason: pathPrefix + ' must contain exactly one subtotal and one total entry (totals.json); this breakdown was not evaluated' });
    out.identity_ok = null;
    return { subtotalEntry, totalEntry, identityEvaluated: false };
  }
  if (unknownTypes.length) {
    for (let u = 0; u < unknownTypes.length; u++) {
      indeterminate.push({ code: 'UNKNOWN_TOTAL_TYPE', reason: 'totals entry type "' + unknownTypes[u] + '" is a Business extension value whose sign semantics this node does not assert; the breakdown identity was not evaluated over it' });
    }
    out.identity_ok = null;
    return { subtotalEntry, totalEntry, identityEvaluated: false };
  }
  if (anyOutOfRange) {
    out.identity_ok = null;
    return { subtotalEntry, totalEntry, identityEvaluated: false };
  }
  const exact = exactSum(known);
  if (!exact.fits) {
    violations.push({ path: pathPrefix, code: 'TOTALS_SUM_OUT_OF_RANGE', reason: 'the canonical breakdown entries sum beyond 2^53-1 minor units, so they cannot equal the declared total entry' });
    out.identity_ok = false;
    return { subtotalEntry, totalEntry, identityEvaluated: false };
  }
  const computed = (exact.neg ? -1 : 1) * limbsValue(exact.mag);
  out.computed_total = computed;
  out.identity_ok = computed === totalEntry.amount;
  if (!out.identity_ok) {
    violations.push({ path: pathPrefix, code: 'TOTALS_IDENTITY_MISMATCH', reason: 'the canonical breakdown entries sum to ' + computed + ', not the declared total ' + totalEntry.amount + ' (subtotal + items_discount + discount + fulfillment + tax + fee = total, discounts negative per total.json)' });
  }
  return { subtotalEntry, totalEntry, identityEvaluated: true };
}

export function compute(pp) {
  pp = pp || {};
  const doc = pp.document;
  // R4: an explicit null reads as absent, so both fall to the default.
  const mode = hasOwn(pp, 'mode') && pp.mode !== null ? pp.mode : 'checkout';
  const policy = hasOwn(pp, 'rounding') && pp.rounding !== null ? pp.rounding : 'half_even';
  if (mode !== 'checkout' && mode !== 'order') {
    return result(shell('INDETERMINATE', { refusal: 'MODE_INVALID', notes: ['mode must be "checkout" or "order"'] }), true);
  }
  if (!isObj(doc)) return result(shell('INDETERMINATE', { mode, refusal: 'DOCUMENT_NOT_OBJECT' }), true);
  if (ROUNDING_POLICIES.indexOf(policy) === -1) {
    return result(shell('INDETERMINATE', { mode, refusal: 'ROUNDING_INVALID', notes: ['rounding must be one of: ' + ROUNDING_POLICIES.join(', ')] }), true);
  }
  const out = shell('INDETERMINATE', { mode, rounding_applied: policy });
  if (typeof doc.currency === 'string' && doc.currency.length <= 16) out.currency = doc.currency;

  const budget = { nodes: 0 };
  const bound = measure(doc, budget);
  if (bound) {
    return result(shell('INDETERMINATE', { mode, rounding_applied: policy, indeterminate: [{ code: bound, reason: 'input exceeds a resource bound; nothing was evaluated' }] }), false);
  }

  const violations = [], skipped = [], indeterminate = [];
  out.violations = violations; out.skipped = skipped; out.indeterminate = indeterminate;

  // ── document-level totals ──────────────────────────────────────────────────
  if (!Array.isArray(doc.totals)) return result(shell('INDETERMINATE', { mode, rounding_applied: policy, refusal: 'TOTALS_NOT_ARRAY' }), true);
  const top = {};
  const topRes = reconcileTotalsArray(doc.totals, '$.totals', violations, indeterminate, top, true);
  if (topRes.refuse) return result(shell('INDETERMINATE', { mode, rounding_applied: policy, refusal: topRes.refuse }), true);
  out.declared_total = top.declared_total;
  out.computed_total = top.computed_total === undefined ? null : top.computed_total;
  out.negative_total = top.negative_total;
  out.totals_identity_ok = top.identity_ok;
  if (out.negative_total) {
    out.notes.push('NEGATIVE_TOTAL: the declared total is negative; UCP issue #1025 records that the total entry carries no sign bound and such documents pass schema validation. Reported informationally, not a mismatch.');
  }

  // ── line items ─────────────────────────────────────────────────────────────
  const lines = Array.isArray(doc.line_items) ? doc.line_items : [];
  if (lines.length > MAX_LINES) {
    indeterminate.push({ code: 'INPUT_BOUND_EXCEEDED', reason: 'line_items exceed the declared bound of ' + MAX_LINES });
    out.truncated = true;
  }
  const lineCount = Math.min(lines.length, MAX_LINES);
  out.line_count = lines.length;
  const lineSubtotals = []; // known line subtotals for the roll-up check
  let exercised = false;
  let lineRefusal = null;
  for (let i = 0; i < lineCount && !lineRefusal; i++) {
    const line = lines[i];
    const p = '$.line_items[' + i + ']';
    if (!isObj(line)) { indeterminate.push({ code: 'LINE_NOT_OBJECT', reason: p + ' is not an object; this line was not evaluated' }); continue; }
    const item = isObj(line.item) ? line.item : null;
    const lr = { line_index: i, path: p, subtotal_declared: null, subtotal_computed: null, price_quantity_ok: null, rounding_applied_here: null, skip_code: null };
    if (!Array.isArray(line.totals)) { lineRefusal = 'LINE_TOTALS_NOT_ARRAY'; break; }
    let sub = null, subCount = 0;
    for (let t = 0; t < line.totals.length && t < MAX_TOTAL_ENTRIES; t++) {
      const rec = readTotalEntry(line.totals[t], p + '.totals[' + t + ']', violations);
      if (rec.refuse) { lineRefusal = rec.refuse; break; }
      if (rec.type === 'subtotal') { subCount++; sub = rec; }
    }
    if (lineRefusal) break;
    if (subCount > 1) {
      indeterminate.push({ code: 'LINE_SUBTOTAL_AMBIGUOUS', reason: p + '.totals carries more than one subtotal-typed entry; the line identity was not evaluated' });
      lr.skip_code = 'LINE_SUBTOTAL_AMBIGUOUS';
      out.line_results.push(lr);
      continue;
    }
    if (sub === null) {
      skipped.push({ path: p, code: 'LINE_SUBTOTAL_MISSING', reason: 'the line totals breakdown carries no subtotal entry; the price x quantity identity was not evaluated for this line' });
      lr.skip_code = 'LINE_SUBTOTAL_MISSING';
      out.line_results.push(lr);
      continue;
    }
    lr.subtotal_declared = sub.amount;
    if (!sub.out_of_range && !sub.sign_violation) lineSubtotals.push(sub.amount);
    const hasUnitPrice = !!(item && hasOwn(item, 'unit_price'));
    const price = item && isInt(item.price) ? item.price : null;
    const qty = isInt(line.quantity) ? line.quantity : null;
    if (price === null || qty === null) {
      skipped.push({ path: p, code: 'PRICE_OR_QUANTITY_MISSING', reason: 'item.price or line.quantity is missing or not an integer; the price x quantity identity was not evaluated' });
      lr.skip_code = 'PRICE_OR_QUANTITY_MISSING';
      out.line_results.push(lr);
      continue;
    }
    if (price < 0 || price > MAX_MINOR) {
      violations.push({ path: p + '.item.price', code: price > MAX_MINOR ? 'AMOUNT_OUT_OF_RANGE' : 'SIGN_VIOLATION', reason: 'item.price must be a non-negative minor-unit integer within +/- 2^53-1 (amount.json)' });
      lr.skip_code = 'PRICE_INVALID';
      out.line_results.push(lr);
      continue;
    }
    if (qty < 1 || qty > MAX_MINOR) {
      violations.push({ path: p + '.quantity', code: 'QUANTITY_OUT_OF_RANGE', reason: 'line.quantity is an integer step count with minimum 1 and maximum 2^53-1 (line_item.json)' });
      lr.skip_code = 'QUANTITY_INVALID';
      out.line_results.push(lr);
      continue;
    }
    let scale = 0;
    if (item && hasOwn(item, 'quantity_unit')) {
      const qu = item.quantity_unit;
      if (!isObj(qu) || !hasOwn(qu, 'unit') || typeof qu.unit !== 'string' || qu.unit.length === 0 || qu.unit.length > MAX_STR) {
        indeterminate.push({ code: 'QUANTITY_UNIT_MALFORMED', reason: p + '.item.quantity_unit is malformed; the line was not evaluated' });
        lr.skip_code = 'QUANTITY_UNIT_MALFORMED';
        out.line_results.push(lr);
        continue;
      }
      scale = hasOwn(qu, 'scale') ? qu.scale : 0;
      if (!isInt(scale) || scale < 0 || scale > 15 || (qu.unit === 'C62' && scale !== 0)) {
        lineRefusal = 'SCALE_INVALID'; // structural per unit.json (scale 0..15, C62 exactly 0)
        break;
      }
    }
    if (hasUnitPrice) {
      skipped.push({ path: p, code: 'PRICING_BASIS_DIFFERS', reason: 'item.unit_price marks a pricing basis different from the sale basis; the Business rounds that comparator once per its own rules (unit_price.json), so the price x quantity identity is not protocol-asserted on this line' });
      lr.skip_code = 'PRICING_BASIS_DIFFERS';
      out.line_results.push(lr);
      continue;
    }
    const prod = priceTimesSteps(price, qty, scale);
    if (prod.overflow) {
      violations.push({ path: p, code: 'LINE_TOTAL_OUT_OF_RANGE', reason: 'price x quantity exceeds 2^53-1 minor units; the line cannot be reconciled in the UCP integer domain' });
      lr.skip_code = 'LINE_TOTAL_OUT_OF_RANGE';
      out.line_results.push(lr);
      continue;
    }
    let computed = prod.quotient;
    if (prod.remainder !== 0) {
      exercised = true;
      lr.rounding_applied_here = policy;
      computed += roundingIncrement(prod.quotient, prod.remainder, POW10[scale], policy);
    }
    lr.subtotal_computed = computed;
    lr.price_quantity_ok = computed === sub.amount;
    if (!lr.price_quantity_ok && !sub.out_of_range) {
      violations.push({ path: p + '.totals', code: 'LINE_SUBTOTAL_MISMATCH', reason: 'price x quantity steps / 10^scale (' + computed + ') does not equal the declared line subtotal (' + sub.amount + ') under the ' + policy + ' policy' });
    }
    out.line_results.push(lr);
  }
  if (lineRefusal) return result(shell('INDETERMINATE', { mode, rounding_applied: policy, refusal: lineRefusal }), true);
  out.rounding_exercised = exercised;
  if (exercised) out.notes.push('rounding was exercised on at least one fractional line; the rule applied is recorded in rounding_applied and per line in line_results[].rounding_applied_here');

  // roll-up: known line subtotals sum to the document subtotal entry
  const subtotalEntry = topRes.subtotalEntry;
  if (subtotalEntry && !subtotalEntry.out_of_range && !subtotalEntry.sign_violation && lineSubtotals.length && !out.truncated) {
    const sum = exactSum(lineSubtotals);
    if (!sum.fits) {
      violations.push({ path: '$.totals', code: 'SUBTOTAL_SUM_OUT_OF_RANGE', reason: 'the line subtotals sum beyond 2^53-1 and cannot equal the declared subtotal entry' });
    } else {
      const sumVal = (sum.neg ? -1 : 1) * limbsValue(sum.mag);
      if (sumVal !== subtotalEntry.amount) {
        violations.push({ path: '$.totals', code: 'SUBTOTAL_ROLLUP_MISMATCH', reason: 'the reconciled line subtotals sum to ' + sumVal + ', not the declared document subtotal ' + subtotalEntry.amount });
      }
    }
  }

  out.evaluated_count = out.line_results.filter(function (r) { return r.price_quantity_ok !== null; }).length + (out.totals_identity_ok !== null ? 1 : 0);
  out.skipped_count = skipped.length + out.line_results.filter(function (r) { return r.skip_code !== null; }).length;

  // ── mode order: adjustments, refund bound, discount attribution ─────────────
  if (mode === 'order') {
    if (!Array.isArray(doc.adjustments)) {
      out.notes.push('NOT_EVALUATED: the order document carries no adjustments array; nothing to reconcile post-order');
    }
    const adjs = Array.isArray(doc.adjustments) ? doc.adjustments : [];
    if (adjs.length > MAX_ADJUSTMENTS) { indeterminate.push({ code: 'INPUT_BOUND_EXCEEDED', reason: 'adjustments exceed the declared bound of ' + MAX_ADJUSTMENTS }); out.truncated = true; }
    const adjNets = [];
    let adjRefusal = null;
    const adjCount = Math.min(adjs.length, MAX_ADJUSTMENTS);
    for (let i = 0; i < adjCount && !adjRefusal; i++) {
      const adj = adjs[i];
      const p = '$.adjustments[' + i + ']';
      if (!isObj(adj)) { indeterminate.push({ code: 'ADJUSTMENT_NOT_OBJECT', reason: p + ' is not an object; this adjustment was not evaluated' }); continue; }
      if (!Array.isArray(adj.totals)) { skipped.push({ path: p, code: 'ADJUSTMENT_TOTALS_MISSING', reason: 'the adjustment carries no totals breakdown; it was not evaluated' }); continue; }
      const aout = { declared_total: null, computed_total: null, identity_ok: null, negative_total: false };
      const res = reconcileTotalsArray(adj.totals, p + '.totals', violations, indeterminate, aout, false);
      if (res.refuse) { adjRefusal = res.refuse; break; }
      if (aout.identity_ok !== null && aout.declared_total !== null) adjNets.push(aout.declared_total);
      else if (aout.identity_ok === null && aout.declared_total !== null) skipped.push({ path: p + '.totals', code: 'ADJUSTMENT_IDENTITY_UNKNOWN', reason: 'this adjustment totals identity could not be evaluated; its net was not counted toward the refund bound' });
    }
    if (adjRefusal) return result(shell('INDETERMINATE', { mode, rounding_applied: policy, refusal: adjRefusal }), true);
    // discount attribution on an order is NOT carried by the protocol (issue #1026)
    out.discount_attribution = {
      status: 'NOT_EVALUATED',
      reason: 'the durable order record carries no applied-discount field, so a totals discount entry cannot be attributed to a code (UCP issue #1026)',
    };
    // refund bound
    if (adjNets.length && out.declared_total !== null && !out.truncated) {
      const net = exactSum(adjNets); // signed sum of adjustment totals
      const returned = net.neg ? limbsValue(net.mag) : 0; // money returned = negative net
      const paid = out.declared_total;
      const ok = returned <= paid;
      out.refunds = { net_refunded: net.neg ? returned : -limbsValue(net.mag), total_paid: paid, ok };
      if (!ok) {
        violations.push({ path: '$.adjustments', code: 'REFUND_EXCEEDS_TOTAL', reason: 'net refunded (' + returned + ') exceeds the declared order total paid (' + paid + ') (adjustment.json: negative adjustment totals are money returned to the buyer)' });
      }
    } else {
      out.refunds = { net_refunded: null, total_paid: out.declared_total, ok: null };
    }
  } else {
    // checkout/cart: report discount attribution when the extension is present
    const dis = doc.discounts;
    const applied = dis && isObj(dis) && Array.isArray(dis.applied) ? dis.applied : null;
    if (applied) {
      const rows = [];
      const sumNums = [];
      let codeCount = 0;
      for (let i = 0; i < applied.length && i < MAX_TOTAL_ENTRIES; i++) {
        const a = applied[i];
        if (!isObj(a) || !isInt(a.amount)) continue;
        rows.push({ code: typeof a.code === 'string' && a.code.length <= MAX_STR ? a.code : null, title: typeof a.title === 'string' && a.title.length <= MAX_STR ? a.title : null, amount: a.amount });
        if (typeof a.code === 'string' && a.code.length <= MAX_STR) codeCount++;
        sumNums.push(a.amount);
      }
      const s = exactSum(sumNums);
      out.discount_attribution = {
        status: codeCount > 0 ? 'REPORTED' : 'REPORTED_NO_CODES',
        applied: rows,
        applied_sum: (s.neg ? -1 : 1) * (s.fits ? limbsValue(s.mag) : null),
        note: 'applied discounts come from the dev.ucp.shopping.discount extension; code is omitted for automatic discounts (discount.json). Reported, not judged.',
      };
    } else {
      out.discount_attribution = { status: 'NOT_PRESENT', note: 'the document carries no discounts.applied[] extension data' };
    }
    out.refunds = null;
  }

  // ── verdict ────────────────────────────────────────────────────────────────
  let verdict;
  if (violations.length) verdict = 'MISMATCH';
  else if (indeterminate.length || out.totals_identity_ok === null) verdict = 'INDETERMINATE';
  else verdict = 'RECONCILED';
  out.verdict = verdict;
  return result(out, false);
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

// 825-reconcile-ucp-checkout-totals — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (≤500 lines, totals arrays ≤100
// entries, adjustments ≤200, amounts within ±2^53-1 minor units, scale 0..15,
// closed refusal set enumerated in the sibling reachability fixtures), so the
// properties below run over a committed mulberry32 seed (deterministic) plus a
// fixed corpus of structural cases: rounding-policy conformance at exact ties,
// the 2^53 boundary, one-unit mutations, and line-order invariance.
//
// kernel_digest_at_authoring: sha256:9a5c782686ba02ea75b2ea3cdbe73e6edfb8abc4e3061119c1cad45ede1fc7bd
// spec: research/UCP-WAVE-BUILD-SPEC-2026-11-03.md — reconcile a pasted UCP
//   (Universal Commerce Protocol, tag v2026-08-25) cart/checkout/order totals
//   block in integer minor units; RECONCILED / MISMATCH / INDETERMINATE;
//   exact base-10 digit-array x base-1e7-limb arithmetic, no float, no BigInt.
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/825-reconcile-ucp-checkout-totals.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../825-reconcile-ucp-checkout-totals.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '825-reconcile-ucp-checkout-totals';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261103;
const N = 200;
const MAX_MINOR = 9007199254740991;

/** half-even reference rounding (matches the kernel's declared default rule). */
function halfEvenRef(q, r, den) {
  const t = r * 2;
  return t > den ? q + 1 : (t < den ? q : (q % 2 === 0 ? q : q + 1));
}

/** Random VALID checkout document over the declared domain. Returns {pp, nLines}. */
function randomValidPp(rng) {
  const nL = 1 + Math.floor(rng() * 4);
  const lines = [];
  let subtotal = 0;
  for (let i = 0; i < nL; i++) {
    const price = 1 + Math.floor(rng() * 50000);
    const qty = 1 + Math.floor(rng() * 50);
    let scale = 0;
    const item = { id: 'sku-' + String(i + 1).padStart(2, '0'), price: price };
    const roll = rng();
    if (roll < 0.25) { scale = 1 + Math.floor(rng() * 2); item.quantity_unit = { unit: 'KGM', scale: scale }; }
    else if (roll < 0.35) { scale = 3; item.quantity_unit = { unit: 'GRM', scale: 3 }; }
    const prod = price * qty; // exact: <= 2,500,000
    const den = Math.pow(10, scale);
    const r = prod % den;
    const q = (prod - r) / den;
    const sub = scale ? halfEvenRef(q, r, den) : prod;
    subtotal += sub;
    lines.push({ item: item, quantity: qty, totals: [{ type: 'subtotal', amount: sub }] });
  }
  const totals = [{ type: 'subtotal', amount: subtotal }];
  let discount = 0;
  if (rng() < 0.6) {
    discount = -(1 + Math.floor(rng() * Math.max(1, subtotal - 1)));
    totals.push({ type: 'discount', amount: discount });
  }
  let fulfillment = 0;
  if (rng() < 0.5) { fulfillment = Math.floor(rng() * 2000); totals.push({ type: 'fulfillment', amount: fulfillment }); }
  const tax = Math.floor(rng() * 100);
  if (tax > 0) totals.push({ type: 'tax', amount: tax });
  let fee = 0;
  if (rng() < 0.2) { fee = 1 + Math.floor(rng() * 50); totals.push({ type: 'fee', amount: fee }); }
  const total = subtotal + discount + fulfillment + tax + fee;
  totals.push({ type: 'total', amount: total });
  const doc = { currency: 'USD', line_items: lines, totals: totals };
  if (discount < 0 && rng() < 0.5) {
    doc.discounts = { applied: [{ code: 'PBTCODE', title: 'proptest synthetic discount', amount: discount }] };
  }
  return { pp: { mode: 'checkout', document: doc }, nLines: nL };
}

// P1 — DETERMINISM + SHAPE + ORACLE AGREEMENT: compute() is a pure function of
// pp (byte-identical output_payload); a fully valid document always reconciles
// (the kernel's half_even line rounding agrees with this test's independent
// reference), and the payload carries the contract shape.
function checkDeterminismShapeOracle() {
  const rng = mulberry32(SEED);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng).pp;
    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    checked++;
    if (a.verdict !== 'RECONCILED') violations++;
    checked += 4;
    if (a.totals_identity_ok !== true) violations++;
    if (typeof a.currency !== 'string' || a.currency !== 'USD') violations++;
    if (typeof a.spec_basis !== 'string' || a.spec_basis.length === 0) violations++;
    if (a.computed_total !== a.declared_total) violations++;
    checked++;
    if (a.line_results.length !== pp.document.line_items.length) violations++;
    for (const lr of a.line_results) {
      checked++;
      if (lr.price_quantity_ok !== true) violations++;
    }
  }
  return { name: 'P1-determinism-shape-reference-oracle', checked: checked, violations: violations };
}

// P2 — ONE-UNIT MUTATION FLIPS THE VERDICT (row-mandated property): changing
// exactly one amount by 1 — the declared total, a line subtotal, or any detail
// entry — must move a RECONCILED document to MISMATCH. The node never shrugs a
// one-unit discrepancy off as rounding or tolerance.
function checkOneUnitFlip() {
  const rng = mulberry32(SEED + 1);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const base = randomValidPp(rng);
    const doc = JSON.parse(JSON.stringify(base.pp.document));
    const dir = rng() < 0.5 ? 1 : -1;
    // m1: declared total
    const d1 = JSON.parse(JSON.stringify(doc));
    for (const t of d1.totals) if (t.type === 'total') t.amount += dir;
    checked++;
    if (compute({ mode: 'checkout', document: d1 }).output_payload.verdict !== 'MISMATCH') violations++;
    // m2: first line subtotal
    const d2 = JSON.parse(JSON.stringify(doc));
    d2.line_items[0].totals[0].amount += dir;
    checked++;
    if (compute({ mode: 'checkout', document: d2 }).output_payload.verdict !== 'MISMATCH') violations++;
    // m3: first detail entry, when one exists
    const d3 = JSON.parse(JSON.stringify(doc));
    const detail = d3.totals.filter(function (t) { return t.type !== 'subtotal' && t.type !== 'total'; });
    if (detail.length) {
      detail[0].amount += dir;
      checked++;
      if (compute({ mode: 'checkout', document: d3 }).output_payload.verdict !== 'MISMATCH') violations++;
    }
  }
  return { name: 'P2-one-unit-amount-change-flips-verdict', checked: checked, violations: violations };
}

// P3 — LINE-ORDER INDEPENDENCE (row-mandated property): permuting line_items
// changes neither the verdict nor any roll-up figure; the per-line results
// re-order with the lines and are otherwise identical.
function checkLineOrderIndependence() {
  const rng = mulberry32(SEED + 2);
  let checked = 0; let violations = 0;
  for (let i = 0; i < N; i++) {
    const built = randomValidPp(rng);
    if (built.nLines < 2) continue;
    const doc = built.pp.document;
    const ref = compute({ mode: 'checkout', document: doc }).output_payload;
    const shuffled = JSON.parse(JSON.stringify(doc));
    // reverse + rotate: a deterministic non-identity permutation of the lines
    const lines = shuffled.line_items;
    const perm = lines.slice(1).concat([lines[0]]).reverse();
    shuffled.line_items = perm;
    const alt = compute({ mode: 'checkout', document: shuffled }).output_payload;
    checked += 5;
    if (alt.verdict !== ref.verdict) violations++;
    if (alt.declared_total !== ref.declared_total || alt.computed_total !== ref.computed_total) violations++;
    if (alt.totals_identity_ok !== ref.totals_identity_ok) violations++;
    if (alt.evaluated_count !== ref.evaluated_count) violations++;
    const key = function (r) { return JSON.stringify([r.subtotal_declared, r.subtotal_computed, r.price_quantity_ok, r.skip_code]); };
    const a = ref.line_results.map(key).sort();
    const b = alt.line_results.map(key).sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P3-line-order-independence', checked: checked, violations: violations };
}

// P4 — REFUSAL PATHS: every committed reachability vector fires its declared
// flag set, refuses as INDETERMINATE with a named refusal code, and never
// claims a totals identity.
function checkRefusalPaths() {
  let checked = 0; let violations = 0;
  for (const vec of REACH.vectors) {
    const r = compute(vec.policy_parameters);
    checked += 3;
    const allFire = vec.observed_flags.every(function (f) { return r.compliance_flags.indexOf(f) !== -1; });
    if (!allFire) violations++;
    if (r.output_payload.verdict !== 'INDETERMINATE' || !r.output_payload.refusal) violations++;
    if (r.output_payload.totals_identity_ok !== null) violations++;
  }
  return { name: 'P4-refusal-paths-reachable-no-identity', checked: checked, violations: violations };
}

// P5 — ROUNDING POLICY CONFORMANCE: for fixed fractional lines (including two
// exact ties), each declared policy produces exactly the mandated neighbour,
// the policy is echoed in rounding_applied and per line, and the default is
// half_even.
function checkRoundingPolicies() {
  const policies = ['half_even', 'half_up', 'half_down', 'floor', 'ceil'];
  // [price, qty, scale] -> quotient/remainder per policy:
  //   A 995x333 scale 2 -> q 3313 r 35 (below the tie: floor/half_* all round down)
  //   B 505x1   scale 1 -> q 50   r 5  (exact tie, 50 even: half_even/half_down/floor stay, ceil/half_up bump)
  //   C 515x1   scale 1 -> q 51   r 5  (exact tie, 51 odd: half_even bumps to the even 52)
  const cases = [
    { p: 995, q: 333, s: 2, want: { half_even: 3313, half_up: 3313, half_down: 3313, floor: 3313, ceil: 3314 } },
    { p: 505, q: 1, s: 1, want: { half_even: 50, half_up: 51, half_down: 50, floor: 50, ceil: 51 } },
    { p: 515, q: 1, s: 1, want: { half_even: 52, half_up: 52, half_down: 51, floor: 51, ceil: 52 } },
  ];
  let checked = 0; let violations = 0;
  for (const c of cases) {
    for (const pol of policies) {
      const doc = {
        currency: 'USD',
        line_items: [{ item: { id: 'frac', price: c.p, quantity_unit: { unit: 'KGM', scale: c.s } }, quantity: c.q, totals: [{ type: 'subtotal', amount: c.want[pol] }] }],
        totals: [{ type: 'subtotal', amount: c.want[pol] }, { type: 'total', amount: c.want[pol] }],
      };
      const out = compute({ mode: 'checkout', rounding: pol, document: doc }).output_payload;
      checked += 4;
      const lr = out.line_results[0];
      if (out.verdict !== 'RECONCILED') violations++;
      if (out.rounding_applied !== pol) violations++;
      if (!out.rounding_exercised || lr.rounding_applied_here !== pol) violations++;
      if (lr.subtotal_computed !== c.want[pol]) violations++;
    }
  }
  // default is half_even when the parameter is absent
  const dflt = compute({ mode: 'checkout', document: {
    currency: 'USD',
    line_items: [{ item: { id: 'tie', price: 505, quantity_unit: { unit: 'KGM', scale: 1 } }, quantity: 1, totals: [{ type: 'subtotal', amount: 50 }] }],
    totals: [{ type: 'subtotal', amount: 50 }, { type: 'total', amount: 50 }],
  } }).output_payload;
  checked += 2;
  if (dflt.rounding_applied !== 'half_even' || dflt.line_results[0].subtotal_computed !== 50) violations++;
  return { name: 'P5-rounding-policy-conformance-with-ties', checked: checked, violations: violations };
}

// P6 — BOUNDS NEVER GUESS: over-bound inputs return INDETERMINATE with a named
// indeterminate code and truncated marker, never a fabricated verdict.
function checkBoundsIndeterminate() {
  let checked = 0; let violations = 0;
  // 501 lines exceeds the declared 500-line bound
  const bigLines = [];
  for (let i = 0; i < 501; i++) bigLines.push({ item: { id: 'b' + i, price: 100 }, quantity: 1, totals: [{ type: 'subtotal', amount: 100 }] });
  const big = compute({ mode: 'checkout', document: {
    currency: 'USD', line_items: bigLines,
    totals: [{ type: 'subtotal', amount: 50100 }, { type: 'total', amount: 50100 }],
  } }).output_payload;
  checked += 3;
  if (big.verdict !== 'INDETERMINATE' || big.truncated !== true) violations++;
  if (!big.indeterminate.some(function (x) { return x.code === 'INPUT_BOUND_EXCEEDED'; })) violations++;
  // nesting deeper than the declared 64-level bound anywhere in the document
  let deep = /** @type {any} */ ({ leaf: 1 });
  for (let i = 0; i < 70; i++) deep = { a: deep };
  const deepOut = compute({ mode: 'checkout', document: {
    currency: 'USD', decoy: deep,
    totals: [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 100 }],
  } }).output_payload;
  checked += 2;
  if (deepOut.verdict !== 'INDETERMINATE') violations++;
  if (!deepOut.indeterminate.some(function (x) { return x.code === 'DEPTH_EXCEEDED'; })) violations++;
  return { name: 'P6-bounds-return-indeterminate-never-guess', checked: checked, violations: violations };
}

// P7 — 2^53 BOUNDARY EXACTNESS: the maximum UCP amount reconciles exactly, and
// a product beyond it (2 x (2^53-1) steps) is a named out-of-range violation,
// not a silent float approximation.
function checkBoundary() {
  let checked = 0; let violations = 0;
  const ok = compute({ mode: 'checkout', document: {
    currency: 'USD',
    line_items: [{ item: { id: 'max-amount', price: MAX_MINOR }, quantity: 1, totals: [{ type: 'subtotal', amount: MAX_MINOR }] }],
    totals: [{ type: 'subtotal', amount: MAX_MINOR }, { type: 'total', amount: MAX_MINOR }],
  } }).output_payload;
  checked += 2;
  if (ok.verdict !== 'RECONCILED' || ok.line_results[0].subtotal_computed !== MAX_MINOR) violations++;
  const over = compute({ mode: 'checkout', document: {
    currency: 'USD',
    line_items: [{ item: { id: 'over-amount', price: MAX_MINOR }, quantity: 2, totals: [{ type: 'subtotal', amount: MAX_MINOR }] }],
    totals: [{ type: 'subtotal', amount: MAX_MINOR }, { type: 'total', amount: MAX_MINOR }],
  } }).output_payload;
  checked += 3;
  if (over.verdict !== 'MISMATCH') violations++;
  if (!over.violations.some(function (v) { return v.code === 'LINE_TOTAL_OUT_OF_RANGE'; })) violations++;
  if (over.line_results[0].subtotal_computed !== null) violations++;
  return { name: 'P7-2p53-boundary-exact-overflow-named', checked: checked, violations: violations };
}

// ── example/property suite: paths the class-K floor above does not exercise ───
// Every expected figure is hand arithmetic written next to the assertion, or an
// independent BigInt recomputation. None of it is copied from the kernel body.

function meter() { return { checked: 0, violations: 0 }; }
function eqNum(m, got, want) { m.checked++; if (got !== want) m.violations++; }
function eqStr(m, got, want) { m.checked++; if (got !== want) m.violations++; }
function assertThat(m, cond) { m.checked++; if (!cond) m.violations++; }
function codeList(list) { return (list || []).map(function (v) { return v.code; }).join(','); }
function pathList(list) { return (list || []).map(function (v) { return v.path; }).join(','); }

// P8 — EXACT REFUSAL SET: every structural malformation refuses the whole call
// with its own named code, INPUT_REFUSED, and no partial findings. A refusal
// that silently degrades into a partial reconciliation could misstate totals.
function checkRefusalCodes() {
  const m = meter();
  const okTotals = [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 100 }];
  const lineWith = function (line) {
    return { mode: 'checkout', document: { totals: okTotals, line_items: [line] } };
  };
  const orderWithAdj = function (totals) {
    return { mode: 'order', document: {
      totals: [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 100 }],
      adjustments: [{ totals: totals }],
    } };
  };
  const cases = [
    ['DOCUMENT_NOT_OBJECT', { mode: 'checkout', document: null }],
    ['MODE_INVALID', { mode: 'cart', document: { totals: okTotals } }],
    ['ROUNDING_INVALID', { mode: 'checkout', rounding: 'bankers', document: { totals: okTotals } }],
    ['TOTALS_NOT_ARRAY', { mode: 'checkout', document: { totals: 5 } }],
    ['ENTRY_NOT_OBJECT', { mode: 'checkout', document: { totals: [null, { type: 'total', amount: 0 }] } }],
    ['ENTRY_TYPE_MISSING', { mode: 'checkout', document: { totals: [{ amount: 1 }, { type: 'total', amount: 0 }] } }],
    ['ENTRY_TYPE_MISSING', { mode: 'checkout', document: { totals: [{ type: 5, amount: 1 }, { type: 'total', amount: 0 }] } }],
    ['ENTRY_AMOUNT_MISSING', { mode: 'checkout', document: { totals: [{ type: 'subtotal' }, { type: 'total', amount: 0 }] } }],
    ['AMOUNT_NOT_INTEGER', { mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 1.5 }, { type: 'total', amount: 0 }] } }],
    ['TOTALS_CARDINALITY', { mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 1 }, { type: 'subtotal', amount: 1 }, { type: 'total', amount: 2 }] } }],
    ['TOTALS_CARDINALITY', { mode: 'checkout', document: { totals: [] } }],
    ['LINE_TOTALS_NOT_ARRAY', lineWith({ item: { price: 1 }, quantity: 1, totals: 5 })],
    ['SCALE_INVALID', lineWith({ item: { price: 1, quantity_unit: { unit: 'KGM', scale: 16 } }, quantity: 1, totals: [{ type: 'subtotal', amount: 0 }] })],
    ['SCALE_INVALID', lineWith({ item: { price: 1, quantity_unit: { unit: 'C62', scale: 1 } }, quantity: 1, totals: [{ type: 'subtotal', amount: 0 }] })],
    ['AMOUNT_NOT_INTEGER', orderWithAdj([{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 1.5 }])],
  ];
  for (const [code, pp] of cases) {
    const r = compute(pp);
    const p = r.output_payload;
    eqStr(m, p.verdict, 'INDETERMINATE');
    eqStr(m, p.refusal, code);
    eqStr(m, r.compliance_flags.join(','), 'INPUT_REFUSED');
    eqNum(m, p.violations.length, 0);
    eqNum(m, p.skipped.length, 0);
    eqNum(m, p.indeterminate.length, 0);
    eqNum(m, p.negative_total, false);
    eqNum(m, p.totals_identity_ok, null);
    eqNum(m, p.evaluated_count, 0);
  }
  const badMode = compute({ mode: 'cart', document: { totals: okTotals } }).output_payload;
  eqStr(m, badMode.notes[0], 'mode must be "checkout" or "order"');
  const badRounding = compute({ mode: 'checkout', rounding: 'bankers', document: { totals: okTotals } }).output_payload;
  eqStr(m, badRounding.notes[0], 'rounding must be one of: half_even, half_up, half_down, floor, ceil');
  return { name: 'P8-exact-refusal-set', checked: m.checked, violations: m.violations };
}

// P9 — SIGN AND RANGE FINDINGS: UCP sign rules are per type (discounts strictly
// negative, subtotal/fulfillment/tax/fee non-negative, total unbounded) and the
// amount domain is +/-2^53-1. Each finding names the exact entry.
function checkSignAndRangeFindings() {
  const m = meter();
  const doc = function (totals) { return { mode: 'checkout', document: { totals: totals } }; };

  // 100 + 5 = 105: identity holds, but a discount may not be positive.
  let p = compute(doc([{ type: 'subtotal', amount: 100 }, { type: 'discount', amount: 5 }, { type: 'total', amount: 105 }])).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  eqStr(m, pathList(p.violations), '$.totals[1].amount');
  eqNum(m, p.totals_identity_ok, true);
  assertThat(m, p.violations[0].reason.indexOf('strictly negative') !== -1);

  // zero is still not strictly negative (exclusiveMaximum 0)
  p = compute(doc([{ type: 'subtotal', amount: 100 }, { type: 'discount', amount: 0 }, { type: 'total', amount: 100 }])).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  eqStr(m, pathList(p.violations), '$.totals[1].amount');

  // fulfillment is non-negative: -1 violates minimum 0
  p = compute(doc([{ type: 'subtotal', amount: 100 }, { type: 'fulfillment', amount: -1 }, { type: 'total', amount: 99 }])).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  eqStr(m, pathList(p.violations), '$.totals[1].amount');

  // subtotal -5 + total -5: the total entry is unbounded (issue #1025), so the
  // only finding is the subtotal sign violation; -5 = -5 keeps the identity.
  p = compute(doc([{ type: 'subtotal', amount: -5 }, { type: 'total', amount: -5 }])).output_payload;
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  eqStr(m, pathList(p.violations), '$.totals[0].amount');
  eqNum(m, p.totals_identity_ok, true);
  eqNum(m, p.computed_total, -5);
  eqNum(m, p.negative_total, true);

  // -2^53 exactly is representable and is NOT out of range; it is only a sign
  // finding for a subtotal. (The bound is |a| <= 2^53-1, so -MAX is inside.)
  p = compute(doc([{ type: 'subtotal', amount: -MAX_MINOR }, { type: 'total', amount: -MAX_MINOR }])).output_payload;
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  assertThat(m, codeList(p.violations).indexOf('AMOUNT_OUT_OF_RANGE') === -1);

  // (2^53-1)+1 is outside the amount domain; the identity is not evaluated.
  p = compute(doc([{ type: 'subtotal', amount: MAX_MINOR + 1 }, { type: 'total', amount: 0 }])).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'AMOUNT_OUT_OF_RANGE');
  eqStr(m, pathList(p.violations), '$.totals[0].amount');
  eqNum(m, p.totals_identity_ok, null);
  eqNum(m, p.computed_total, null);
  eqNum(m, p.declared_total, 0);
  assertThat(m, p.violations[0].reason.indexOf('2^53-1') !== -1);

  // -(2^53-1)-1 is likewise outside the domain.
  p = compute(doc([{ type: 'subtotal', amount: -MAX_MINOR - 1 }, { type: 'total', amount: 0 }])).output_payload;
  eqStr(m, codeList(p.violations), 'AMOUNT_OUT_OF_RANGE');
  eqNum(m, p.totals_identity_ok, null);

  // line-level price: -1 is a sign violation, not a quantity problem
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'neg', price: -1 }, quantity: 1, totals: [{ type: 'subtotal', amount: 0 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  eqStr(m, pathList(p.violations), '$.line_items[0].item.price');
  eqStr(m, p.line_results[0].skip_code, 'PRICE_INVALID');
  eqNum(m, p.line_results[0].subtotal_computed, null);

  // price above the domain is AMOUNT_OUT_OF_RANGE, not SIGN_VIOLATION
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'big', price: MAX_MINOR + 1 }, quantity: 1, totals: [{ type: 'subtotal', amount: 0 }] }] } }).output_payload;
  eqStr(m, codeList(p.violations), 'AMOUNT_OUT_OF_RANGE');
  eqStr(m, p.line_results[0].skip_code, 'PRICE_INVALID');

  // quantity domain is 1..2^53-1
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'q0', price: 1 }, quantity: 0, totals: [{ type: 'subtotal', amount: 0 }] }] } }).output_payload;
  eqStr(m, codeList(p.violations), 'QUANTITY_OUT_OF_RANGE');
  eqStr(m, pathList(p.violations), '$.line_items[0].quantity');
  eqStr(m, p.line_results[0].skip_code, 'QUANTITY_INVALID');
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'qmax', price: 1 }, quantity: MAX_MINOR + 1, totals: [{ type: 'subtotal', amount: 0 }] }] } }).output_payload;
  eqStr(m, codeList(p.violations), 'QUANTITY_OUT_OF_RANGE');

  // a fractional quantity/price is not an integer identity input: skip, do not guess
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'frac', price: 1.5 }, quantity: 1, totals: [{ type: 'subtotal', amount: 0 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqStr(m, p.skipped[0].code, 'PRICE_OR_QUANTITY_MISSING');
  eqStr(m, p.line_results[0].skip_code, 'PRICE_OR_QUANTITY_MISSING');
  eqNum(m, p.line_results[0].price_quantity_ok, null);

  // a line that is not an object, a line with two subtotals, and a line with no
  // subtotal each have their own named non-evaluation path
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [null] } }).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'LINE_NOT_OBJECT');
  eqNum(m, p.line_results.length, 0);
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'two', price: 1 }, quantity: 1, totals: [{ type: 'subtotal', amount: 1 }, { type: 'subtotal', amount: 1 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'LINE_SUBTOTAL_AMBIGUOUS');
  eqStr(m, p.line_results[0].skip_code, 'LINE_SUBTOTAL_AMBIGUOUS');
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }], line_items: [{ item: { id: 'none', price: 1 }, quantity: 1, totals: [{ type: 'tax', amount: 0 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqStr(m, p.skipped[0].code, 'LINE_SUBTOTAL_MISSING');
  eqStr(m, p.line_results[0].skip_code, 'LINE_SUBTOTAL_MISSING');

  // item.unit_price means the pricing basis differs from the sale basis: skip
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 100 }], line_items: [{ item: { id: 'up', price: 100, unit_price: 120 }, quantity: 1, totals: [{ type: 'subtotal', amount: 100 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqStr(m, p.skipped[0].code, 'PRICING_BASIS_DIFFERS');
  eqStr(m, p.line_results[0].skip_code, 'PRICING_BASIS_DIFFERS');

  // quantity_unit: unit is required; scale defaults to 0 when absent
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 5 }, { type: 'total', amount: 5 }], line_items: [{ item: { id: 'u', price: 5, quantity_unit: { scale: 0 } }, quantity: 1, totals: [{ type: 'subtotal', amount: 5 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'QUANTITY_UNIT_MALFORMED');
  eqStr(m, p.line_results[0].skip_code, 'QUANTITY_UNIT_MALFORMED');
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 5 }, { type: 'total', amount: 5 }], line_items: [{ item: { id: 'c62', price: 5, quantity_unit: { unit: 'C62' } }, quantity: 1, totals: [{ type: 'subtotal', amount: 5 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.line_results[0].subtotal_computed, 5);
  return { name: 'P9-sign-and-range-findings', checked: m.checked, violations: m.violations };
}

// P10 — TOTALS IDENTITY EDGE CASES: extension types, amounts beyond 2^53-1, a
// breakdown whose own sum overflows, and a legitimately negative total.
function checkTotalsIdentityEdges() {
  const m = meter();

  // an unknown (Business extension) type makes the identity unevaluable, and a
  // repeated unknown type is reported once, not once per entry
  let p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 100 }, { type: 'gift_wrap', amount: 5 }, { type: 'gift_wrap', amount: 6 }, { type: 'total', amount: 111 }] } }).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqNum(m, p.indeterminate.length, 1);
  eqStr(m, p.indeterminate[0].code, 'UNKNOWN_TOTAL_TYPE');
  eqNum(m, p.totals_identity_ok, null);
  eqNum(m, p.computed_total, null);
  eqNum(m, p.declared_total, 111);
  eqNum(m, p.evaluated_count, 0);

  // an unknown type also leaves the totals identity unevaluated, while a broken
  // line roll-up still makes the document a MISMATCH (verdict precedence)
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 100 }, { type: 'gift_wrap', amount: 5 }, { type: 'total', amount: 105 }], line_items: [{ item: { id: 'r', price: 200 }, quantity: 1, totals: [{ type: 'subtotal', amount: 200 }] }] } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.indeterminate), 'UNKNOWN_TOTAL_TYPE');
  eqNum(m, p.totals_identity_ok, null);
  assertThat(m, codeList(p.violations).indexOf('SUBTOTAL_ROLLUP_MISMATCH') !== -1);

  // 2^53-1 + 2^53-1 + 2^53-1 overflows the exact sum: named, not guessed
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: MAX_MINOR }, { type: 'tax', amount: MAX_MINOR }, { type: 'fee', amount: MAX_MINOR }, { type: 'total', amount: MAX_MINOR }] } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'TOTALS_SUM_OUT_OF_RANGE');
  eqStr(m, pathList(p.violations), '$.totals');
  eqNum(m, p.totals_identity_ok, false);
  eqNum(m, p.computed_total, null);
  eqStr(m, p.violations[0].reason, 'the canonical breakdown entries sum beyond 2^53-1 minor units, so they cannot equal the declared total entry');

  // a plain identity mismatch carries the computed figure in its message
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 100 }, { type: 'total', amount: 101 }] } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'TOTALS_IDENTITY_MISMATCH');
  eqNum(m, p.computed_total, 100);
  eqNum(m, p.declared_total, 101);
  eqStr(m, p.violations[0].reason, 'the canonical breakdown entries sum to 100, not the declared total 101 (subtotal + items_discount + discount + fulfillment + tax + fee = total, discounts negative per total.json)');

  // total.json has no sign bound: 100 + (-9,999,999) = -9,999,899 reconciles
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 100 }, { type: 'discount', amount: -9999999 }, { type: 'total', amount: -9999899 }] } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.negative_total, true);
  eqNum(m, p.computed_total, -9999899);
  eqNum(m, p.declared_total, -9999899);
  eqNum(m, p.violations.length, 0);
  assertThat(m, p.notes[0].indexOf('NEGATIVE_TOTAL:') === 0);
  // the same figures with a non-negative total must NOT raise the note
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 100 }, { type: 'discount', amount: -100 }, { type: 'total', amount: 0 }] } }).output_payload;
  eqNum(m, p.negative_total, false);
  eqNum(m, p.notes.length, 0);

  // a -0-style zero total is not negative
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }] } }).output_payload;
  eqNum(m, p.negative_total, false);
  return { name: 'P10-totals-identity-edges', checked: m.checked, violations: m.violations };
}

// P11 — ORDER MODE: adjustment identities, the refund bound (net refunded may
// not exceed the paid total), the 200-adjustment bound, and the attribution
// gap the durable order record has by design (UCP issue #1026).
function checkOrderRefundBound() {
  const m = meter();
  const NET_PAID = 3000 - 500; // subtotal 3000, discount -500
  const orderDoc = function (adjustments) {
    const doc = { currency: 'USD', totals: [{ type: 'subtotal', amount: 3000 }, { type: 'discount', amount: -500 }, { type: 'total', amount: NET_PAID }] };
    if (adjustments !== undefined) doc.adjustments = adjustments;
    return { mode: 'order', document: doc };
  };
  // 0 - n = -n: a refund of n, net total -n
  const refund = function (n) { return { totals: [{ type: 'subtotal', amount: 0 }, { type: 'discount', amount: -n }, { type: 'total', amount: -n }] }; };
  // plain charge of n: subtotal n = total n
  const charge = function (n) { return { totals: [{ type: 'subtotal', amount: n }, { type: 'total', amount: n }] }; };

  let p = compute(orderDoc([refund(1000)])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.refunds.net_refunded, 1000);
  eqNum(m, p.refunds.total_paid, 2500);
  eqNum(m, p.refunds.ok, true);
  eqStr(m, p.discount_attribution.status, 'NOT_EVALUATED');

  // exactly the paid total is still within the bound (<=, not <)
  p = compute(orderDoc([refund(2500)])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.refunds.net_refunded, 2500);
  eqNum(m, p.refunds.ok, true);

  // one unit over is a named violation: 2501 > 2500
  p = compute(orderDoc([refund(2501)])).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'REFUND_EXCEEDS_TOTAL');
  eqStr(m, pathList(p.violations), '$.adjustments');
  eqNum(m, p.refunds.net_refunded, 2501);
  eqNum(m, p.refunds.ok, false);
  eqStr(m, p.violations[0].reason, 'net refunded (2501) exceeds the declared order total paid (2500) (adjustment.json: negative adjustment totals are money returned to the buyer)');

  // a net charge is not money returned: net_refunded -500, ok
  p = compute(orderDoc([charge(500)])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.refunds.net_refunded, -500);
  eqNum(m, p.refunds.ok, true);

  // 1000 + 500 - 200 = 1300 net returned (a charge offsets a refund)
  p = compute(orderDoc([refund(1000), refund(500), charge(200)])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.refunds.net_refunded, 1300);
  eqNum(m, p.refunds.ok, true);

  // exactly 200 adjustments is inside the bound; 201 is truncated and the
  // refund bound is not evaluated over a partial list
  const twoHundred = [];
  for (let i = 0; i < 200; i++) twoHundred.push(refund(1));
  p = compute(orderDoc(twoHundred)).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.truncated, false);
  eqNum(m, p.refunds.net_refunded, 200);
  eqNum(m, p.refunds.ok, true);
  const twoOhOne = twoHundred.concat([refund(1)]);
  p = compute(orderDoc(twoOhOne)).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqNum(m, p.truncated, true);
  eqStr(m, codeList(p.indeterminate), 'INPUT_BOUND_EXCEEDED');
  eqNum(m, p.refunds.net_refunded, null);
  eqNum(m, p.refunds.total_paid, 2500);
  eqNum(m, p.refunds.ok, null);

  // no adjustments array: explicitly not evaluated, not silently "0 refunded"
  p = compute(orderDoc(undefined)).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.notes.length, 1);
  eqStr(m, p.notes[0], 'NOT_EVALUATED: the order document carries no adjustments array; nothing to reconcile post-order');
  eqNum(m, p.refunds.net_refunded, null);
  eqNum(m, p.refunds.total_paid, 2500);
  eqNum(m, p.refunds.ok, null);

  // adjustment without totals is skipped, not counted as zero
  p = compute(orderDoc([{ reason: 'goodwill' }])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqStr(m, p.skipped[0].code, 'ADJUSTMENT_TOTALS_MISSING');
  eqStr(m, p.skipped[0].path, '$.adjustments[0]');
  eqNum(m, p.refunds.net_refunded, null);

  // a non-object adjustment is named and left out
  p = compute(orderDoc(['nope'])).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'ADJUSTMENT_NOT_OBJECT');
  eqNum(m, p.refunds.ok, null);

  // broken cardinality inside an adjustment is indeterminate (non-strict), and
  // its net is not counted toward the refund bound
  p = compute(orderDoc([{ totals: [{ type: 'total', amount: -100 }] }])).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'TOTALS_CARDINALITY');
  eqStr(m, p.skipped[0].code, 'ADJUSTMENT_IDENTITY_UNKNOWN');
  eqStr(m, p.skipped[0].path, '$.adjustments[0].totals');
  eqNum(m, p.refunds.net_refunded, null);
  eqNum(m, p.refunds.ok, null);

  // an unknown type inside an adjustment likewise suppresses its net
  p = compute(orderDoc([{ totals: [{ type: 'subtotal', amount: 0 }, { type: 'discount', amount: -100 }, { type: 'mystery', amount: -1 }, { type: 'total', amount: -101 }] }])).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'UNKNOWN_TOTAL_TYPE');
  eqStr(m, p.skipped[0].code, 'ADJUSTMENT_IDENTITY_UNKNOWN');
  eqNum(m, p.refunds.net_refunded, null);

  // a malformed adjustment amount still refuses the whole call
  p = compute(orderDoc([{ totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 1.5 }] }])).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, p.refusal, 'AMOUNT_NOT_INTEGER');

  // checkout-style discounts data on an order is explicitly not attributed
  const withDiscounts = orderDoc([refund(1000)]);
  withDiscounts.document.discounts = { applied: [{ code: 'SAVE10', amount: -500 }] };
  p = compute(withDiscounts).output_payload;
  eqStr(m, p.discount_attribution.status, 'NOT_EVALUATED');
  eqNum(m, p.discount_attribution.applied, undefined);
  return { name: 'P11-order-refund-bound', checked: m.checked, violations: m.violations };
}

// P12 — CHECKOUT DISCOUNT ATTRIBUTION: reported, never judged; code is omitted
// for automatic discounts; the 100-entry bound applies.
function checkDiscountAttribution() {
  const m = meter();
  const withApplied = function (applied) {
    return { mode: 'checkout', document: {
      currency: 'USD',
      totals: [{ type: 'subtotal', amount: 1000 }, { type: 'discount', amount: -150 }, { type: 'total', amount: 850 }],
      discounts: { applied: applied },
    } };
  };
  const NOTE = 'applied discounts come from the dev.ucp.shopping.discount extension; code is omitted for automatic discounts (discount.json). Reported, not judged.';

  let p = compute(withApplied([{ code: 'SAVE10', title: 'ten off', amount: -100 }, { amount: -50 }])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqStr(m, p.discount_attribution.status, 'REPORTED');
  eqNum(m, p.discount_attribution.applied.length, 2);
  eqStr(m, p.discount_attribution.applied[0].code, 'SAVE10');
  eqStr(m, p.discount_attribution.applied[1].code, null);
  eqNum(m, p.discount_attribution.applied_sum, -150); // -100 + -50
  eqStr(m, p.discount_attribution.note, NOTE);

  // every automatic discount: reported, but no codes were present
  p = compute(withApplied([{ title: 'auto', amount: -150 }])).output_payload;
  eqStr(m, p.discount_attribution.status, 'REPORTED_NO_CODES');
  eqNum(m, p.discount_attribution.applied_sum, -150);
  eqStr(m, p.discount_attribution.applied[0].code, null);

  // an empty applied array asserts nothing and reports zero
  p = compute(withApplied([])).output_payload;
  eqStr(m, p.discount_attribution.status, 'REPORTED_NO_CODES');
  eqNum(m, p.discount_attribution.applied_sum, 0);

  // applied present but not an array: not reported
  p = compute({ mode: 'checkout', document: { currency: 'USD', totals: [{ type: 'subtotal', amount: 1000 }, { type: 'total', amount: 1000 }], discounts: { applied: { 0: { amount: -1 } } } } }).output_payload;
  eqStr(m, p.discount_attribution.status, 'NOT_PRESENT');

  // no discounts extension at all
  p = compute({ mode: 'checkout', document: { currency: 'USD', totals: [{ type: 'subtotal', amount: 1000 }, { type: 'total', amount: 1000 }] } }).output_payload;
  eqStr(m, p.discount_attribution.status, 'NOT_PRESENT');

  // a non-object entry and a non-integer amount are ignored by the report
  p = compute(withApplied([{ code: 'A', amount: 1.5 }, 'x', { code: 'B', amount: -1 }])).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.discount_attribution.applied.length, 1);
  eqStr(m, p.discount_attribution.applied[0].code, 'B');
  eqNum(m, p.discount_attribution.applied_sum, -1);

  // 100 entries are reported, a 101st is outside the declared bound
  const many = [];
  for (let i = 0; i < 100; i++) many.push({ code: 'C', amount: -1 });
  many.push({ code: 'X', amount: -1000 });
  p = compute(withApplied(many)).output_payload;
  eqNum(m, p.discount_attribution.applied.length, 100);
  eqNum(m, p.discount_attribution.applied_sum, -100); // 100 x -1, the 101st is not read

  // a 4096-character code/title is kept verbatim; MAX_STR is 4096
  const long = 'c'.repeat(4096);
  p = compute(withApplied([{ code: long, title: long, amount: -1 }])).output_payload;
  eqStr(m, p.discount_attribution.status, 'REPORTED');
  eqNum(m, p.discount_attribution.applied[0].code.length, 4096);
  eqNum(m, p.discount_attribution.applied[0].title.length, 4096);

  // a non-string code is reported as no code
  p = compute(withApplied([{ code: 5, amount: -1 }])).output_payload;
  eqStr(m, p.discount_attribution.status, 'REPORTED_NO_CODES');
  eqStr(m, p.discount_attribution.applied[0].code, null);
  return { name: 'P12-discount-attribution', checked: m.checked, violations: m.violations };
}

// P13 — COUNTS AND SUBTOTAL ROLL-UP: evaluated/skipped counts are exact, line
// subtotals roll up to the document subtotal, and only usable entries count.
function checkCountsAndRollup() {
  const m = meter();

  // one evaluated line + the totals identity = 2 evaluated.
  // one line without a subtotal produces one skip record AND one skipped line
  // result, so skipped_count counts it twice by construction (2).
  let p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: 500 }, { type: 'total', amount: 500 }],
    line_items: [
      { item: { id: 'a', price: 500 }, quantity: 1, totals: [{ type: 'subtotal', amount: 500 }] },
      { item: { id: 'b', price: 7 }, quantity: 1, totals: [{ type: 'tax', amount: 1 }] },
    ],
  } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.evaluated_count, 2);
  eqNum(m, p.skipped_count, 2);
  eqNum(m, p.skipped.length, 1);
  eqNum(m, p.line_results[1].skip_code, 'LINE_SUBTOTAL_MISSING');
  eqNum(m, p.line_results[0].price_quantity_ok, true);

  // 500 + 500 = 1000, declared 1200: roll-up mismatch with the difference named
  p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: 1200 }, { type: 'total', amount: 1200 }],
    line_items: [
      { item: { id: 'a', price: 500 }, quantity: 1, totals: [{ type: 'subtotal', amount: 500 }] },
      { item: { id: 'b', price: 500 }, quantity: 1, totals: [{ type: 'subtotal', amount: 500 }] },
    ],
  } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SUBTOTAL_ROLLUP_MISMATCH');
  eqStr(m, pathList(p.violations), '$.totals');
  eqNum(m, p.evaluated_count, 3); // two lines + identity
  eqStr(m, p.violations[0].reason, 'the reconciled line subtotals sum to 1000, not the declared document subtotal 1200');

  // no line items: the roll-up is not evaluated, so no roll-up violation
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 500 }, { type: 'total', amount: 500 }] } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.violations.length, 0);
  eqNum(m, p.evaluated_count, 1);

  // a sign-violating line subtotal is excluded from the roll-up: 500 (not 495)
  // equals the declared 500, so only the line's own findings remain.
  p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: 500 }, { type: 'total', amount: 500 }],
    line_items: [
      { item: { id: 'ok', price: 500 }, quantity: 1, totals: [{ type: 'subtotal', amount: 500 }] },
      { item: { id: 'neg', price: 5 }, quantity: 1, totals: [{ type: 'subtotal', amount: -5 }] },
    ],
  } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION,LINE_SUBTOTAL_MISMATCH');
  assertThat(m, codeList(p.violations).indexOf('SUBTOTAL_ROLLUP_MISMATCH') === -1);

  // a sign-violating DOCUMENT subtotal suppresses the roll-up entirely, even
  // though the line subtotal (500) differs from it (-5)
  p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: -5 }, { type: 'total', amount: -5 }],
    line_items: [{ item: { id: 'ok', price: 500 }, quantity: 1, totals: [{ type: 'subtotal', amount: 500 }] }],
  } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SIGN_VIOLATION');
  assertThat(m, codeList(p.violations).indexOf('SUBTOTAL_ROLLUP_MISMATCH') === -1);

  // an out-of-range line subtotal is not usable for the roll-up
  p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }],
    line_items: [{ item: { id: 'oor', price: 0 }, quantity: 1, totals: [{ type: 'subtotal', amount: MAX_MINOR + 1 }] }],
  } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'AMOUNT_OUT_OF_RANGE');
  assertThat(m, codeList(p.violations).indexOf('SUBTOTAL_ROLLUP_MISMATCH') === -1);

  // line subtotals that overflow the exact sum are named as such
  p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: MAX_MINOR }, { type: 'total', amount: MAX_MINOR }],
    line_items: [1, 2, 3].map(function () { return { item: { id: 'big', price: MAX_MINOR }, quantity: 1, totals: [{ type: 'subtotal', amount: MAX_MINOR }] }; }),
  } }).output_payload;
  eqStr(m, p.verdict, 'MISMATCH');
  eqStr(m, codeList(p.violations), 'SUBTOTAL_SUM_OUT_OF_RANGE');
  eqStr(m, p.violations[0].reason, 'the line subtotals sum beyond 2^53-1 and cannot equal the declared subtotal entry');

  // exactly 500 lines (the declared bound) is fully evaluated
  const fiveHundred = [];
  for (let i = 0; i < 500; i++) fiveHundred.push({ item: { id: 'l' + i, price: 1 }, quantity: 1, totals: [{ type: 'subtotal', amount: 1 }] });
  p = compute({ mode: 'checkout', document: { totals: [{ type: 'subtotal', amount: 500 }, { type: 'total', amount: 500 }], line_items: fiveHundred } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.truncated, false);
  eqNum(m, p.line_count, 500);
  eqNum(m, p.evaluated_count, 501); // 500 lines + identity
  eqNum(m, p.skipped_count, 0);
  return { name: 'P13-counts-and-rollup', checked: m.checked, violations: m.violations };
}

// P14 — RESOURCE BOUNDS AT THEIR EXACT EDGE: MAX_NODES=20000, MAX_STR=4096,
// MAX_DEPTH=64, MAX_TOTAL_ENTRIES=100. At the bound the document reconciles;
// one over the bound returns INDETERMINATE with the bound named.
function checkResourceBoundEdges() {
  const m = meter();
  const docWithDecoy = function (decoy) {
    return { mode: 'checkout', document: {
      currency: 'USD',
      decoy: decoy,
      totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }],
    } };
  };
  // node count: 1 (document) + 1 (currency) + 1 (decoy array) + N zeros
  // + 1 (totals array) + 2 entries x (1 object + 2 values) = N + 10
  let p = compute(docWithDecoy(new Array(19990).fill(0))).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.indeterminate.length, 0);
  // 19991 zeros => 20001 nodes, one over the bound
  p = compute(docWithDecoy(new Array(19991).fill(0))).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'INPUT_BOUND_EXCEEDED');
  eqStr(m, p.indeterminate[0].reason, 'input exceeds a resource bound; nothing was evaluated');
  eqStr(m, p.rounding_applied, 'half_even');
  eqNum(m, p.compliance_flags, undefined);
  eqNum(m, p.evaluated_count, 0);

  // a string of exactly 4096 characters is kept; 4097 exceeds MAX_STR
  p = compute(docWithDecoy('x'.repeat(4096))).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  p = compute(docWithDecoy('x'.repeat(4097))).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'INPUT_BOUND_EXCEEDED');

  // nesting: deepest node at depth 64 is allowed; depth 65 is not
  const nest = function (n) { let leaf = /** @type {any} */ (1); for (let i = 0; i < n; i++) leaf = { a: leaf }; return leaf; };
  p = compute(docWithDecoy(nest(62))).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  p = compute(docWithDecoy(nest(63))).output_payload;
  eqStr(m, p.verdict, 'INDETERMINATE');
  eqStr(m, codeList(p.indeterminate), 'DEPTH_EXCEEDED');

  // exactly 100 totals entries reconcile, and all of them count: 9800 + 98*100
  const hundred = [{ type: 'subtotal', amount: 9800 }];
  for (let i = 0; i < 98; i++) hundred.push({ type: 'fee', amount: 100 });
  hundred.push({ type: 'total', amount: 19600 });
  p = compute({ mode: 'checkout', document: { totals: hundred } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.computed_total, 19600);
  eqNum(m, p.declared_total, 19600);
  eqNum(m, p.violations.length, 0);

  // a 101st entry is outside the bound and is not read: a sign violation placed
  // there cannot change the verdict
  const over = hundred.concat([{ type: 'discount', amount: 5 }]);
  p = compute({ mode: 'checkout', document: { totals: over } }).output_payload;
  eqStr(m, p.verdict, 'RECONCILED');
  eqNum(m, p.violations.length, 0);
  eqNum(m, p.computed_total, 19600);
  return { name: 'P14-resource-bound-edges', checked: m.checked, violations: m.violations };
}

// P15 — CURRENCY AND DEFAULT FLAGS: currency is echoed only when it is a short
// string; rounding is reported as not exercised on integer-only lines.
function checkCurrencyAndDefaults() {
  const m = meter();
  const doc = function (currency) {
    return { mode: 'checkout', document: { currency: currency, totals: [{ type: 'subtotal', amount: 0 }, { type: 'total', amount: 0 }] } };
  };
  let p = compute(doc('ABCDEFGHIJKLMNOP')).output_payload; // 16 characters
  eqStr(m, p.currency, 'ABCDEFGHIJKLMNOP');
  p = compute(doc('ABCDEFGHIJKLMNOPQ')).output_payload; // 17 characters
  eqNum(m, p.currency, null);
  p = compute(doc(5)).output_payload;
  eqNum(m, p.currency, null);

  // integer-only lines never exercise rounding
  p = compute({ mode: 'checkout', document: {
    totals: [{ type: 'subtotal', amount: 7 }, { type: 'total', amount: 7 }],
    line_items: [{ item: { id: 'int', price: 7 }, quantity: 1, totals: [{ type: 'subtotal', amount: 7 }] }],
  } }).output_payload;
  eqStr(m, p.rounding_applied, 'half_even');
  eqNum(m, p.rounding_exercised, false);
  eqNum(m, p.line_results[0].rounding_applied_here, null);
  eqNum(m, p.notes.length, 0);
  return { name: 'P15-currency-and-default-flags', checked: m.checked, violations: m.violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminismShapeOracle(),
  checkOneUnitFlip(),
  checkLineOrderIndependence(),
  checkRefusalPaths(),
  checkRoundingPolicies(),
  checkBoundsIndeterminate(),
  checkBoundary(),
  checkRefusalCodes(),
  checkSignAndRangeFindings(),
  checkTotalsIdentityEdges(),
  checkOrderRefundBound(),
  checkDiscountAttribution(),
  checkCountsAndRollup(),
  checkResourceBoundEdges(),
  checkCurrencyAndDefaults(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — UCP cart/checkout/order totals reconcile (RECONCILED / MISMATCH / INDETERMINATE).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);

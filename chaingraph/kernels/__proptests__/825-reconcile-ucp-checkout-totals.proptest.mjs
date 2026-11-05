// 825-reconcile-ucp-checkout-totals — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (≤500 lines, totals arrays ≤100
// entries, adjustments ≤200, amounts within ±2^53-1 minor units, scale 0..15,
// closed refusal set enumerated in the sibling reachability fixtures), so the
// properties below run over a committed mulberry32 seed (deterministic) plus a
// fixed corpus of structural cases: rounding-policy conformance at exact ties,
// the 2^53 boundary, one-unit mutations, and line-order invariance.
//
// kernel_digest_at_authoring: sha256:b13886293e623c2a9f1191776a7fcb5a23868a1bae8d40ae48648cb932f09d79
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
];
console.log(`[${KERNEL_ID}] class-K floor property test — UCP cart/checkout/order totals reconcile (RECONCILED / MISMATCH / INDETERMINATE).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);

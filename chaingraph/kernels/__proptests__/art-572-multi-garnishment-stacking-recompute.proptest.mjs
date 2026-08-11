// art-572-multi-garnishment-stacking-recompute.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:40566c4874e0229d5ecd0a9656e3643dfaabfb3bfdc79ddc78a332d900bec3bf
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row). `pctOf(minor, pct) =
// Math.round((minor * pct) / 100)` is real IEEE-754 arithmetic that sets every statutory cap
// (child-support tiers at 50/55/60/65%, the general CCPA 25% cap, the HEA AWG 15% cap), and
// `display()` repeats the same `Math.trunc(abs / MINOR_SCALE)` division the C25 shard kept float:yes
// for on art-509/art-508. Both feed the per-order withheld/shortfall amounts directly.
// Checks: fixture-oracle gate, termination (bounded by orders.length/legally_required_deductions.length,
// no unbounded loop), differential re-derivation of pctOf()-based statutory caps and the
// priority-order withholding walk, ULP-boundary forcing on pctOf()'s Math.round((minor*pct)/100)
// boundary and display()'s Math.trunc(abs/100) boundary, and a conservation metamorphic identity
// (total_withheld + employee_net always equals disposable_earnings, and total_withheld never exceeds
// the aggregate cap, for any random stack).
//
// Run: node chaingraph/kernels/__proptests__/art-572-multi-garnishment-stacking-recompute.proptest.mjs

import { compute } from '../art-572-multi-garnishment-stacking-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-572-multi-garnishment-stacking-recompute.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x57200);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const ORDER_TYPES = ['child_support', 'federal_tax_levy', 'state_levy', 'hea_awg', 'creditor', 'other'];

function randomOrders(rng) {
  const n = 1 + Math.floor(rng() * 4);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ order_id: `O${i}`, type: pick(rng, ORDER_TYPES), arrears_over_12wk: rng() < 0.5, second_family: rng() < 0.5, claimed_amount_minor_units: Math.floor(rng() * 500000) });
  }
  return out;
}

function randomPP(rng) {
  return {
    employee_ref: 'E1', period_label: 'P1', currency: 'USD',
    gross_minor_units: 500000 + Math.floor(rng() * 2000000),
    legally_required_deductions: rng() < 0.7 ? [{ label: 'FICA', amount_minor_units: Math.floor(rng() * 100000) }] : [],
    orders: randomOrders(rng),
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- bounded by orders.length/deductions.length ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.order_count !== pp.orders.length) violations++;
    if (output_payload.orders.length !== pp.orders.length) violations++;
  }
  return { name: 'P1_termination_bounded_by_order_count', trials: checked, violations };
}

// ---------- P2 (differential): re-derive statutory caps and the priority-order withholding walk ----------
function checkP2_cap_and_withhold_differential() {
  let violations = 0, checked = 0;
  function pctOf(minor, pct) { return Math.round((minor * pct) / 100); }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const disposable = output_payload.disposable_earnings_minor_units;
    const floor = output_payload.ccpa_floor_minor_units;
    const nonNegFloor = Math.max(disposable - floor, 0);
    let expectedAggregate = 0;
    const expectedCaps = pp.orders.map((o) => {
      let cap;
      if (o.type === 'child_support') { const pct = o.arrears_over_12wk ? (o.second_family ? 55 : 65) : (o.second_family ? 50 : 60); cap = pctOf(disposable, pct); }
      else if (o.type === 'federal_tax_levy') cap = disposable;
      else if (o.type === 'state_levy') cap = Math.min(pctOf(disposable, 25), nonNegFloor);
      else if (o.type === 'hea_awg') cap = Math.min(pctOf(disposable, 15), nonNegFloor);
      else cap = Math.min(pctOf(disposable, 25), nonNegFloor);
      if (cap > expectedAggregate) expectedAggregate = cap;
      return cap;
    });
    if (output_payload.aggregate_cap_minor_units !== expectedAggregate) violations++;
    for (let oi = 0; oi < pp.orders.length; oi++) {
      if (output_payload.orders[oi].cap_minor_units !== expectedCaps[oi]) violations++;
    }
    // Re-derive the priority-order withholding walk.
    let remDisposable = disposable, remAggregate = expectedAggregate, expectedTotal = 0;
    for (let oi = 0; oi < pp.orders.length; oi++) {
      const claim = Math.max(0, pp.orders[oi].claimed_amount_minor_units);
      const allowedByOrder = Math.min(claim, Math.max(0, expectedCaps[oi]));
      const allowed = Math.max(0, Math.min(allowedByOrder, remDisposable, remAggregate));
      if (output_payload.orders[oi].withheld_minor_units !== allowed) violations++;
      remDisposable -= allowed; remAggregate -= allowed; expectedTotal += allowed;
    }
    if (output_payload.total_withheld_minor_units !== expectedTotal) violations++;
  }
  return { name: 'P2_cap_and_withhold_walk_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on pctOf()'s Math.round((minor*pct)/100) and display() Math.trunc ----------
function checkP3_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const disposables = [0, 1, 99, 100, 101, 100000, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, 3333333333];
  // federal_minimum_wage defaults to the 725-cent prefill, so ccpa_floor = 30*725 = 21750; force it to
  // zero here so the hea_awg/creditor Math.min(pctOf(...), nonNegFloor) branch always resolves via the
  // pctOf() SIDE of the min (the one under test), never the unrelated floor side.
  for (const disp of disposables) {
    if (!Number.isSafeInteger(disp)) continue;
    // child_support tiers (50/55/60/65%) -- no floor min, pctOf() alone sets the cap.
    for (const pct of [50, 55, 60, 65]) {
      checked++;
      const arrears = pct === 55 || pct === 65, secondFamily = pct === 50 || pct === 55;
      const pp = { employee_ref: 'E', period_label: 'P', currency: 'USD', gross_minor_units: disp, legally_required_deductions: [], federal_minimum_wage_minor_units: 0, orders: [{ order_id: 'O1', type: 'child_support', arrears_over_12wk: arrears, second_family: secondFamily, claimed_amount_minor_units: disp }] };
      const { output_payload } = compute(pp);
      const expected = Math.round((disp * pct) / 100);
      if (output_payload.orders[0].cap_minor_units !== expected) violations++;
    }
    // hea_awg (15%) and the general CCPA cap (25%, via "other") -- with the floor forced to zero,
    // Math.min(pctOf(disposable, pct), nonNegFloor) resolves to pctOf() whenever disposable <= itself,
    // i.e. always here since nonNegFloor = disposable - 0 = disposable >= pctOf(disposable, pct).
    for (const row of [{ pct: 15, type: 'hea_awg' }, { pct: 25, type: 'other' }]) {
      checked++;
      const pp = { employee_ref: 'E', period_label: 'P', currency: 'USD', gross_minor_units: disp, legally_required_deductions: [], federal_minimum_wage_minor_units: 0, orders: [{ order_id: 'O1', type: row.type, claimed_amount_minor_units: disp }] };
      const { output_payload } = compute(pp);
      const expected = Math.round((disp * row.pct) / 100);
      if (output_payload.orders[0].cap_minor_units !== expected) violations++;
    }
  }
  // display() ULP: exact multiples of 100, boundary residues.
  for (const amt of [0, 1, 99, 100, 100001, Number.MAX_SAFE_INTEGER]) {
    checked++;
    const pp = { employee_ref: 'E', period_label: 'P', currency: 'USD', gross_minor_units: amt, legally_required_deductions: [], orders: [] };
    const { output_payload } = compute(pp);
    const whole = Math.trunc(amt / 100); const frac = amt - whole * 100;
    const expected = String(whole) + '.' + String(frac).padStart(2, '0');
    if (output_payload.gross_display !== expected) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_pctof_and_display', trials: checked, violations };
}

// ---------- P4: conservation metamorphic -- total_withheld + net === disposable; withheld <= aggregate cap ----------
function checkP4_conservation_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.total_withheld_minor_units + output_payload.employee_net_minor_units !== output_payload.disposable_earnings_minor_units) violations++;
    if (output_payload.total_withheld_minor_units > output_payload.aggregate_cap_minor_units) violations++;
    if (output_payload.total_withheld_minor_units > output_payload.disposable_earnings_minor_units) violations++;
    if (output_payload.total_withheld_minor_units < 0) violations++;
  }
  return { name: 'P4_withheld_plus_net_equals_disposable_conservation', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_cap_and_withhold_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_conservation_identity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-572-multi-garnishment-stacking-recompute',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

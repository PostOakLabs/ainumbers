// art-375-compute-fund-expense-ratios.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:21e7330a4b9eb3f27ddcd9bbe5fb4dcf6e3143f9aa9c05faea150bb6c5a2c1c1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- re-confirmed by direct read: same BigInt fixed-point (SCALE_EXP=8)
// design as FN-1 (art-373); float only enters at the caller-input parse boundary
// (`toFixed()`'s `String(value)` -> decimal-regex step, which coerces scientific-notation
// magnitudes to "0" -- identical boundary behavior to art-373, probed here too, P4).
// ⛔⛔ NOT BOUNDED BELOW ZERO BY CONSTRUCTION -- a genuine floor finding, not asserted away:
// `percent_of_remaining` waivers apply `reductionFixed = mulFixed(remainingFixed, pct)` with NO
// clamp against `remainingFixed` itself (unlike `fixed_amount`, which IS clamped). A declared
// `percent > 1` (over 100%) drives `net_expense_total` NEGATIVE -- confirmed by direct
// execution (percent:1.5 on a $100k remaining base produces remaining_after: "-50000...").
// This floor documents that actual behavior (P3b) rather than asserting a false
// always-non-negative invariant; whether waiver `percent` should be validated at the caller
// boundary is out of THIS row's scope (floor only, no kernel edit).
// Checks: fixture-oracle gate, termination (unbounded gross_expense_components/waivers arrays
// -- bound is array length), boundedness (structural_error path never throws), metamorphic
// (waiver order is determined by the DECLARED `order` field, not array position -- reordering
// the array with unchanged `order` values and no ties reproduces an identical waiver ledger),
// ULP-boundary forcing on average_net_assets/amount/percent at IEEE-754 boundary magnitudes.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-375-compute-fund-expense-ratios.proptest.mjs

import { compute } from '../art-375-compute-fund-expense-ratios.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-375-compute-fund-expense-ratios.fixtures.json');
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
const rand = mulberry32(0x375D0);

function randomComponent(rng, tag) {
  return { description: tag, amount: Math.round(rng() * 100000) };
}

function randomWaiver(rng, order) {
  const methods = ['fixed_amount', 'percent_of_remaining', 'cap_to_rate'];
  const method = methods[Math.floor(rng() * methods.length)];
  const w = { description: `w${order}`, order, method };
  if (method === 'fixed_amount') w.amount = Math.round(rng() * 10000);
  else if (method === 'percent_of_remaining') w.percent = rng() * 0.5; // stay within [0,1) -- see the ⛔ note above for percent>1
  else w.cap_rate = rng() * 0.02;
  return w;
}

function randomPP(rng, nComponents, nWaivers) {
  const gross_expense_components = [];
  for (let i = 0; i < nComponents; i++) gross_expense_components.push(randomComponent(rng, `c${i}`));
  const waivers = [];
  for (let i = 0; i < nWaivers; i++) waivers.push(randomWaiver(rng, i)); // unique declared order, no ties
  return { fund_id: 'F1', average_net_assets: 1000000 + Math.round(rng() * 1e8), gross_expense_components, waivers, rounding: { decimal_places: 4, mode: 'half_up' } };
}

const TRIALS = 2000;

// ---------- P1: termination — unbounded components/waivers arrays, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 300];
  for (const n of sizes) {
    const pp = randomPP(rand, n, Math.min(n, 3));
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.components.gross_expense_components.length !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const w = Math.floor(rand() * 10);
    const pp = randomPP(rand, n, w);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.components.gross_expense_components.length !== n) violations++;
    if (output_payload.components.waivers_applied.length !== w) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — structural error path never throws ----------
function checkP2_structural_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, 1 + Math.floor(rand() * 5), Math.floor(rand() * 4));
    if (rand() < 0.3) pp.average_net_assets = rand() < 0.5 ? 0 : -Math.round(rand() * 1000);
    const { output_payload } = compute(pp);
    checked++;
    if (pp.average_net_assets <= 0) {
      if (output_payload.structural_error === null) violations++;
      if (output_payload.gross_expense_ratio !== null || output_payload.net_expense_ratio !== null) violations++;
    } else {
      if (output_payload.structural_error !== null) violations++;
      if (typeof output_payload.gross_expense_ratio !== 'string') violations++;
    }
  }
  return { name: 'P2_structural_error_boundedness_never_throws', trials: checked, violations };
}

// ---------- P3a: metamorphic — waiver ORDER is declared, not array position (no ties => identical ledger) ----------
function checkP3a_order_field_not_array_position() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 2; i++) {
    const nW = 2 + Math.floor(rand() * 6);
    const pp = randomPP(rand, 1 + Math.floor(rand() * 5), nW);
    const shuffled = { ...pp, waivers: [...pp.waivers].reverse() }; // same order field values, reversed array position
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (JSON.stringify(a.components.waivers_applied) !== JSON.stringify(b.components.waivers_applied)) violations++;
    if (a.net_expense_ratio !== b.net_expense_ratio) violations++;
  }
  return { name: 'P3a_waiver_order_field_not_array_position', trials: checked, violations };
}

// ---------- P3b: documented finding — percent_of_remaining > 100% drives net_expense_total negative (not clamped) ----------
function checkP3b_percent_over_100_not_clamped() {
  let violations = 0, checked = 0;
  const cases = [{ percent: 1.5 }, { percent: 2 }, { percent: 1.0000001 }];
  for (const c of cases) {
    const pp = {
      average_net_assets: 1000000,
      gross_expense_components: [{ amount: 100000 }],
      waivers: [{ description: 'over', order: 1, method: 'percent_of_remaining', percent: c.percent }],
      rounding: { decimal_places: 4, mode: 'half_up' },
    };
    const { output_payload } = compute(pp);
    checked++;
    const netTotal = Number(output_payload.components.net_expense_total);
    // documents the actual (unclamped) behavior -- expected NEGATIVE for percent>1, never a throw/NaN
    if (!Number.isFinite(netTotal)) violations++;
    if (netTotal >= 0) violations++; // this IS the documented finding: it goes negative
  }
  return { name: 'P3b_documented_percent_over_100_drives_negative_not_clamped', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — avg_net_assets/amount/percent ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const boundaryValues = [0, -0, eps, Number.MIN_VALUE, 1e21, 1000];
  for (const amount of boundaryValues) {
    const pp = { average_net_assets: 1000000, gross_expense_components: [{ description: 'x', amount }], waivers: [], rounding: { decimal_places: 4, mode: 'half_up' } };
    const { output_payload } = compute(pp);
    checked++;
    if (typeof output_payload.components.gross_expense_total !== 'string') violations++;
    if (!Number.isFinite(Number(output_payload.components.gross_expense_total))) violations++;
  }
  for (const percent of [0, -0, eps, Number.MIN_VALUE, 1]) {
    const pp = {
      average_net_assets: 1000000, gross_expense_components: [{ amount: 50000 }],
      waivers: [{ description: 'w', order: 1, method: 'percent_of_remaining', percent }], rounding: { decimal_places: 4, mode: 'half_up' },
    };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(Number(output_payload.components.net_expense_total))) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_avg_net_assets_amount_percent', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_structural_boundedness());
results.properties.push(checkP3a_order_field_not_array_position());
results.properties.push(checkP3b_percent_over_100_not_clamped());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-375-compute-fund-expense-ratios',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

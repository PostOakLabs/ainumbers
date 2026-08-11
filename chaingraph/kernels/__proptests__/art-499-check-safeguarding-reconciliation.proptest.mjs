// art-499-check-safeguarding-reconciliation.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:ee7c278f77ba168b6c221d6a703d01ad0390c884fd1551198e71f423d3fe4554
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔⛔ CORRECTION TO THE WU ROW'S TABLE (per FIX-2, "confirm float-sensitivity... before relying
// on the table"): the row lists this kernel as float:yes, mandating ULP-boundary forcing. Direct
// read of the kernel's own header and compute() shows this is FALSE — the kernel's own docstring
// states verbatim "FIXED-POINT MONEY MATH... there is no floating-point arithmetic anywhere in
// compute(): sums, differences and tolerance comparisons are integer operations." Every amount is
// coerced through toMinorUnits(), which requires Number.isSafeInteger and REJECTS (never
// silently accepts) any non-integer value, routing it to rejected_inputs and treating it as 0.
// There is therefore no floating-point threshold in this kernel to ULP-force: an "ULP-boundary"
// test would be fabricating a property about arithmetic that does not exist in the source. This
// file floors it correctly instead: forced CATEGORICAL boundary cases at the actual (integer)
// decision boundaries — the tolerance threshold, exactly-reconciled, one-minor-unit-over/under,
// negative-tolerance-input, non-integer-amount rejection, and denormal/oversized amount rejection —
// per spec §3's float:no fallback ("forced categorical boundary cases instead of an ULP claim").
// Checks: fixture-oracle gate, termination (components bounded by input array length),
// forced categorical boundary cases around the reconciliation tolerance threshold, differential
// re-derivation of verdict/difference_direction/rejected_inputs, boundedness (every component's
// amount_minor_units is a safe integer, subtotals sum to the resource total), and metamorphic
// component-append invariance (appending a zero-amount, correctly-typed component never changes
// the verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-499-check-safeguarding-reconciliation.proptest.mjs

import { compute } from '../art-499-check-safeguarding-reconciliation.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-499-check-safeguarding-reconciliation.fixtures.json');
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
const rand = mulberry32(0x499F0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const COMPONENT_TYPES = ['relevant_funds_bank_account', 'segregated_not_yet_placed', 'relevant_assets', 'insurance_or_guarantee'];

function randomComponents(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      account_ref: `ACC-${i}`,
      component_type: pick(rng, COMPONENT_TYPES.concat(['bogus_type'])),
      amount_minor_units: Math.floor((rng() - 0.3) * 2000000),
    });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return {
    as_of_date: '2026-07-29',
    currency: 'GBP',
    reconciliation_type: pick(rng, ['internal', 'external']),
    safeguarding_requirement_minor_units: Math.floor(rng() * 5000000),
    tolerance_minor_units: pick(rng, [0, 100, 500, -50]),
    safeguarding_resource_components: randomComponents(rng, n),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — components.length exactly matches input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.component_count !== pp.safeguarding_resource_components.length) violations++;
    if (output_payload.components.length !== pp.safeguarding_resource_components.length) violations++;
  }
  return { name: 'P1_termination_components_exact', trials: checked, violations };
}

// ---------- P2: forced categorical boundary cases around the (integer) tolerance threshold ----------
function checkP2_tolerance_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    // exactly at tolerance: difference === tolerance -> reconciled (within_tolerance uses <=)
    { requirement: 1000, resource: 1100, tolerance: 100, expectVerdict: 'reconciled' },
    // one minor unit over tolerance -> shortfall (resource below requirement... wait resource>req is excess)
    { requirement: 1100, resource: 1000, tolerance: 99, expectVerdict: 'shortfall' },
    { requirement: 1000, resource: 1101, tolerance: 100, expectVerdict: 'excess' },
    // zero tolerance, exact match -> reconciled
    { requirement: 5000, resource: 5000, tolerance: 0, expectVerdict: 'reconciled' },
    // zero tolerance, off by one -> shortfall
    { requirement: 5000, resource: 4999, tolerance: 0, expectVerdict: 'shortfall' },
    // negative tolerance input is coerced to its absolute value (toleranceSigned < 0 ? -toleranceSigned : ...)
    { requirement: 1000, resource: 1000, tolerance: -50, expectVerdict: 'reconciled' },
  ];
  for (const c of cases) {
    const pp = { as_of_date: '2026-01-01', currency: 'GBP', reconciliation_type: 'internal', safeguarding_requirement_minor_units: c.requirement, tolerance_minor_units: c.tolerance, safeguarding_resource_components: [{ account_ref: 'A', component_type: 'relevant_funds_bank_account', amount_minor_units: c.resource }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== c.expectVerdict) violations++;
  }
  // non-integer / non-finite / unsafe amounts are rejected, never NaN-propagated
  const rejectCases = [1.5, NaN, Infinity, '100', null, undefined, Number.MAX_SAFE_INTEGER + 10];
  for (const v of rejectCases) {
    const pp = { as_of_date: '2026-01-01', currency: 'GBP', reconciliation_type: 'internal', safeguarding_requirement_minor_units: 0, tolerance_minor_units: 0, safeguarding_resource_components: [{ account_ref: 'A', component_type: 'relevant_funds_bank_account', amount_minor_units: v }] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.components[0].amount_minor_units !== 0) violations++;
    if (output_payload.rejected_inputs.length !== (v === undefined || v === null ? 1 : 1)) violations++;
    if (!Number.isFinite(output_payload.safeguarding_resource_minor_units)) violations++;
  }
  return { name: 'P2_tolerance_threshold_forced_categorical_boundary', trials: checked, violations };
}

// ---------- P3 (differential): verdict/difference_direction re-derivation, integer-exact ----------
function checkP3_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let resource = 0;
    for (const c of pp.safeguarding_resource_components) {
      const recognised = COMPONENT_TYPES.includes(c.component_type);
      if (recognised && Number.isSafeInteger(c.amount_minor_units)) resource += c.amount_minor_units;
    }
    const requirement = Number.isSafeInteger(pp.safeguarding_requirement_minor_units) ? pp.safeguarding_requirement_minor_units : 0;
    const tolerance = Math.abs(Number.isSafeInteger(pp.tolerance_minor_units) ? pp.tolerance_minor_units : 0);
    const diff = resource - requirement;
    const expectedVerdict = Math.abs(diff) <= tolerance ? 'reconciled' : (diff < 0 ? 'shortfall' : 'excess');
    if (output_payload.verdict !== expectedVerdict) violations++;
    if (output_payload.safeguarding_resource_minor_units !== resource) violations++;
    if (output_payload.difference_minor_units !== diff) violations++;
  }
  return { name: 'P3_verdict_and_resource_total_differential', trials: checked, violations };
}

// ---------- P4: boundedness — every amount is a safe integer, subtotals sum to resource total ----------
function checkP4_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isSafeInteger(output_payload.safeguarding_resource_minor_units)) violations++;
    let subtotalSum = 0;
    for (const s of output_payload.subtotals_by_component_type) {
      if (!Number.isSafeInteger(s.amount_minor_units)) violations++;
      subtotalSum += s.amount_minor_units;
    }
    if (subtotalSum !== output_payload.safeguarding_resource_minor_units) violations++;
    for (const c of output_payload.components) {
      if (!Number.isSafeInteger(c.amount_minor_units)) violations++;
    }
  }
  return { name: 'P4_boundedness_safe_integers_and_subtotal_sum', trials: checked, violations };
}

// ---------- P5: metamorphic — appending a zero-amount, correctly-typed component never changes the verdict ----------
function checkP5_append_zero_component_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const extended = { ...pp, safeguarding_resource_components: [...pp.safeguarding_resource_components, { account_ref: 'ZERO', component_type: 'relevant_assets', amount_minor_units: 0 }] };
    const r2 = compute(extended).output_payload;
    checked++;
    if (r1.verdict !== r2.verdict) violations++;
    if (r1.safeguarding_resource_minor_units !== r2.safeguarding_resource_minor_units) violations++;
    if (r2.component_count !== r1.component_count + 1) violations++;
  }
  return { name: 'P5_append_zero_component_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_tolerance_boundary_categorical());
results.properties.push(checkP3_verdict_differential());
results.properties.push(checkP4_boundedness());
results.properties.push(checkP5_append_zero_component_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-499-check-safeguarding-reconciliation',
  float_sensitive: false,
  float_sensitive_correction: 'WU row table said float:yes; direct source read shows the kernel is documented and implemented as fixed-point integer-only money math with no floating-point arithmetic anywhere in compute(). Corrected to float:no; floored with forced categorical boundary cases instead of ULP-boundary forcing.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

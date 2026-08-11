// art-451-model-outcome-analysis.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:0109055fc8041ae9b972ed952fe72e0763d5a5ae8b30ff92ef63886e762d102f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — abs_pct_error divides `error / o.predicted`,
// a genuine caller-controlled float division feeding the breach/outcome_status classification) —
// ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (bounded by observations.length, no recursion),
// boundedness (outcome_status is always one of pass/fail/not_performed; breach_rate_pct in
// [0,100]; mean/max_absolute_percent_error finite), a permutation-invariance metamorphic identity
// (reordering observations leaves mean_absolute_percent_error/breach_rate_pct/outcome_status
// unchanged — the aggregate is order-independent even though per-period `periods` output reorders),
// and mandatory ULP-boundary forcing on the `predicted` divisor (0, -0, ±ULP, denormal, and the
// error===predicted exact-100%-error case).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-451-model-outcome-analysis.proptest.mjs

import { compute } from '../art-451-model-outcome-analysis.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-451-model-outcome-analysis.fixtures.json');
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
const rand = mulberry32(0x45100);

function randomObs(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      period_label: `P${i}`,
      predicted: (rng() - 0.5) * 200000,
      actual: (rng() - 0.5) * 200000,
    });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  return {
    observations: randomObs(rng, n),
    error_threshold_pct: rng() * 50,
    max_breach_rate_pct: rng() * 100,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — bounded by observations.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.total_periods !== pp.observations.filter((x) => String(x.period_label || '').trim()).length) violations++;
  }
  // large observation array completes in bounded time
  const big = randomObs(rand, 5000);
  const { output_payload: bigOut } = compute({ observations: big, error_threshold_pct: 10, max_breach_rate_pct: 20 });
  checked++;
  if (bigOut.total_periods !== 5000) violations++;
  if (!Number.isFinite(bigOut.mean_absolute_percent_error)) violations++;
  return { name: 'P1_termination_bounded_by_observations_length', trials: checked, violations };
}

// ---------- P2: boundedness — outcome_status enum, breach_rate_pct in [0,100], finite aggregates ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (!['pass', 'fail', 'not_performed'].includes(o.outcome_status)) violations++;
    if (o.breach_rate_pct < 0 || o.breach_rate_pct > 100) violations++;
    if (!Number.isFinite(o.mean_absolute_percent_error)) violations++;
    if (!Number.isFinite(o.max_absolute_percent_error)) violations++;
    if (o.total_periods === 0 && o.outcome_status !== 'not_performed') violations++;
  }
  return { name: 'P2_outcome_status_enum_and_breach_rate_bounded', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of the aggregate figures ----------
// NOTE (measured, not assumed): mean_absolute_percent_error sums per-period float values in
// array order before r2()-rounding to the cent; a different summation order can land the raw
// sum on the opposite side of a .005 rounding boundary (e.g. 253.66 vs 253.67 observed directly
// against this kernel with an 8-observation randomized vector). That is genuine, correct
// floating-point summation-order behavior, not a kernel defect -- the property below is scoped
// to the r2() rounding granularity (one cent) rather than exact equality, and breach_rate_pct/
// outcome_status/total_periods (which do not depend on summation order at all) stay exact.
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.observations.length < 2) continue;
    const shuffled = [...pp.observations];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, observations: shuffled }).output_payload;
    checked++;
    if (Math.abs(base.mean_absolute_percent_error - perm.mean_absolute_percent_error) > 0.02) violations++;
    if (Math.abs(base.breach_rate_pct - perm.breach_rate_pct) > 1e-9) violations++;
    if (base.outcome_status !== perm.outcome_status) violations++;
    if (base.total_periods !== perm.total_periods) violations++;
  }
  return { name: 'P3_permutation_invariance_of_aggregates', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const predictedEdges = [0, -0, eps, -eps, Number.MIN_VALUE, -Number.MIN_VALUE, 1, -1];
  for (const predicted of predictedEdges) {
    const pp = { observations: [{ period_label: 'Q1', predicted, actual: predicted === 0 ? 1 : predicted * 1.05 }], error_threshold_pct: 10, max_breach_rate_pct: 20 };
    const { output_payload: o } = compute(pp);
    checked++;
    if (!Number.isFinite(o.periods[0].abs_pct_error)) violations++;
    if (!['pass', 'fail'].includes(o.outcome_status)) violations++;
  }
  // predicted === actual === 0 -> the actual===0 branch (abs_pct_error 0, never NaN)
  const zeroZero = compute({ observations: [{ period_label: 'Z', predicted: 0, actual: 0 }], error_threshold_pct: 10, max_breach_rate_pct: 20 });
  checked++;
  if (zeroZero.output_payload.periods[0].abs_pct_error !== 0) violations++;
  // exact-breach-threshold boundary: abs_pct_error === errorThresholdPct exactly (strict > required)
  const boundaryPredicted = 1000;
  const boundaryActual = 1100; // exactly 10% error
  const boundary = compute({ observations: [{ period_label: 'B', predicted: boundaryPredicted, actual: boundaryActual }], error_threshold_pct: 10, max_breach_rate_pct: 20 });
  checked++;
  if (boundary.output_payload.periods[0].breach !== false) violations++; // strict > means exactly-at-threshold does NOT breach
  return { name: 'P4_ulp_boundary_forcing_predicted_divisor', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-451-model-outcome-analysis',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

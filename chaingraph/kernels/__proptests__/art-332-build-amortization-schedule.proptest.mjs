// art-332-build-amortization-schedule.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:8885c70d3b73687cac1d701f769dca9e13c67e4101c9ff6cd9707922f141439b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — periodic-rate division/multiplication,
// compoundFactor loop over (1+periodicRate), levelPaymentCents' `Math.abs(periodicRate) < 1e-12`
// near-zero-rate branch) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (schedule length always equals declared
// num_payments regardless of size — the unbounded input is num_payments/rate_changes array,
// not a data-dependent loop bound; this kernel is a fixed-iteration-count builder, not an
// iterative solver, so no convergence-or-report obligation applies per spec §3), a
// convergence-or-report-shaped re-derivation of the kernel's own final-period true-up (line
// 71/139 unconditionally closes ending_balance to 0 for every schedule_type, so
// SCHEDULE_DID_NOT_FULLY_AMORTIZE and the residual must always agree, including on a
// deliberately underfunded payment_amount override), boundedness (advances[0].amount ===
// loan_amount, every schedule row finite), and ULP-boundary forcing on note_rate_pct around the
// levelPaymentCents near-zero-rate threshold plus 0/-0/denormal cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-332-build-amortization-schedule.proptest.mjs

import { compute } from '../art-332-build-amortization-schedule.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  // schedule_digest is added by buildArtifact() (async executionHash over schedule[]), not by
  // compute() -- compare compute()'s own output only, excluding that post-hoc field.
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-332-build-amortization-schedule.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const { schedule_digest: _sd, ...expected } = vec.output_payload;
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(expected);
    if (a !== b) failures.push({ name: vec.name, expected, got: output_payload });
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
const rand = mulberry32(0x332A0);
const SCHEDULE_TYPES = ['level_payment', 'interest_only', 'balloon', 'temp_buydown'];

function randomPP(rng) {
  return {
    schedule_type: SCHEDULE_TYPES[Math.floor(rng() * SCHEDULE_TYPES.length)],
    loan_amount: 1000 + rng() * 500000,
    note_rate_pct: rng() * 25,
    num_payments: Math.floor(rng() * 480) + 1,
    periods_per_year: [12, 26, 52, 1][Math.floor(rng() * 4)],
  };
}

const TRIALS = 4000;

// ---------- P1: termination — schedule length always equals declared num_payments ----------
function checkP1_termination_length_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.schedule.length !== pp.num_payments) violations++;
    if (output_payload.num_payments !== pp.num_payments) violations++;
  }
  // deliberately large num_payments — the loop bound is num_payments itself, never runaway.
  const big = compute({ schedule_type: 'level_payment', loan_amount: 300000, note_rate_pct: 6.5, num_payments: 600, periods_per_year: 12 });
  checked++;
  if (big.output_payload.schedule.length !== 600) violations++;
  return { name: 'P1_termination_schedule_length_bounded_by_num_payments', trials: checked, violations };
}

// ---------- P2 (convergence-or-report re-derivation): the final-period true-up (line 71/139)
// forces every schedule_type -- including an underfunded payment_amount override and ARM
// non-recast -- to close ending_balance to exactly 0; SCHEDULE_DID_NOT_FULLY_AMORTIZE (line 286)
// therefore only fires on a genuine residual, and this property re-derives the kernel's own
// >0.01-cent check unconditionally: the flag and the residual must always agree. ----------
function checkP2_convergence_or_report() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const notFullyAmortized = Math.abs(output_payload.totals.ending_balance) > 0.01;
    const flagged = compliance_flags.includes('SCHEDULE_DID_NOT_FULLY_AMORTIZE');
    if (notFullyAmortized !== flagged) violations++;
    // the final-period true-up is unconditional for every schedule_type this kernel emits --
    // an underfunded payment_amount override must still close to 0, never report non-amortization.
    if (notFullyAmortized) violations++;
  }
  // deliberately pathological: caller-supplied payment_amount far too small to cover interest --
  // the true-up still forces exact closure (this is the "report" side of the property: the
  // schedule reports full principal recovery at the final period regardless of the shortfall).
  const pathological = { schedule_type: 'level_payment', loan_amount: 100000, note_rate_pct: 8, num_payments: 12, periods_per_year: 12, payment_amount: 1 };
  const { output_payload: po, compliance_flags: pf } = compute(pathological);
  checked++;
  if (Math.abs(po.totals.ending_balance) > 0.01) violations++;
  if (pf.includes('SCHEDULE_DID_NOT_FULLY_AMORTIZE')) violations++;
  return { name: 'P2_final_period_trueup_forces_closure_report_agreement', trials: checked, violations };
}

// ---------- P3: boundedness — advances[0] equals loan_amount, every row finite ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.advances[0].amount !== Math.max(0, pp.loan_amount)) violations++;
    for (const r of output_payload.schedule) {
      if (!Number.isFinite(r.payment_amount) || !Number.isFinite(r.principal) || !Number.isFinite(r.interest) || !Number.isFinite(r.ending_balance)) violations++;
    }
  }
  return { name: 'P3_advances_and_rows_bounded_finite', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — near-zero-rate threshold ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  // levelPaymentCents' `Math.abs(periodicRate) < 1e-12` boundary: periodicRate = note_rate_pct/100/periods_per_year
  // -> note_rate_pct threshold ~= 1e-12 * 100 * periods_per_year = 1.2e-9 for periods_per_year=12
  const rates = [0, -0, eps, 1.2e-9 - eps, 1.2e-9 + eps, Number.MIN_VALUE, 1e-300, 1e-15];
  for (const rate of rates) {
    const pp = { schedule_type: 'level_payment', loan_amount: 50000, note_rate_pct: rate, num_payments: 24, periods_per_year: 12 };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.schedule.length !== 24) violations++;
    for (const r of output_payload.schedule) {
      if (!Number.isFinite(r.payment_amount) || !Number.isFinite(r.ending_balance)) violations++;
    }
  }
  return { name: 'P4_ulp_boundary_forcing_near_zero_rate_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_length_bounded());
results.properties.push(checkP2_convergence_or_report());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-332-build-amortization-schedule',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

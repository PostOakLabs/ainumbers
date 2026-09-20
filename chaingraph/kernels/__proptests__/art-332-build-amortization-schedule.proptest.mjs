// art-332-build-amortization-schedule.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:c43a019193d999e9f93930a4bf793f51192c11245151211f1c26f038629caef9
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
//
// MUTATION-MODE TRIAL CAP (ART332-MUTATION-TIER-COST-1, test-side cost cut;
// the ART215-MUTATION-TIER-COST-1 / site PR 1969 shape ported verbatim — same
// detection, same env override, no second flag):
// Under the mutation tier (scripts/run-mutation-tier.mjs, Stryker 8.7.1 command
// runner) each of this kernel's 384 mutants (on origin/main 4419268e, measured
// 2026-09-20) re-runs this whole floor against Stryker's INSTRUMENTED kernel,
// and the instrumenter is the cost: the full-trial floor runs in ~0.38 s
// standalone (measured on this file: wall 379 ms incl. node boot) but the
// tier's initial dry run measured net 6518 ms on origin/main — a ~21x
// instrumenter factor on the same ~12,000 compute() calls. Projection at full
// trials: 384 x ~6.5 s / 2 runners ~ 1,248 s, past the 600 s per-kernel bound
// (MUTATION-TIER-HANG-MMS03-PNR01-1) — reproduced on the row: the tier HARD
// FAILS at 600 s, killed before any money-math line prints.
//
// Cost driver, measured (not guessed): compute() is a fixed-iteration-count
// schedule builder whose cost is ~linear in num_payments — median 2 us at
// num_payments=1, 4 us at 6, 10 us at 60, 18 us at 240, 34 us at 480
// (generator range 1..480, mean ~240). That CLOSES the generator-range lever
// the way PR 1969 closed it for art-215: fitting 384 mutants / 2 runners
// inside 600 s needs a per-pass ~3 s, i.e. a mean num_payments ~110 — which
// would amputate the entire upper half of the range (every schedule over ~220
// payments, the very rows P1's 600-payment bound case guards) in mutation
// mode. The chosen lever is TRIAL COUNT, capped IN MUTATION MODE ONLY,
// detected two ways exactly as art-215/pnr-01 before it: (a) the seam Stryker
// itself owns — CommandTestRunner.mutantRun() sets env __STRYKER_ACTIVE_MUTANT__
// for MUTANT runs; (b) the tier sandbox cwd — run-mutation-tier.mjs copies
// this proptest into %TEMP%\ain-mutation-tier-<pid>\ and runs the Stryker
// INITIAL DRY RUN there too, so __dirname under that root marks dry-run
// context (a full-trial dry run would also blow the bound: 6.5 s is inside
// Stryker's 300 s dryRunTimeout here, but the dry run must be capped for the
// same bound arithmetic as the mutant runs; the floor is still validated at
// FULL trials by this file's standalone repo-checkout run, outside the tier,
// where neither detection fires). Default cap 50 (a capped pass takes the
// first 50 draws per property of the SAME seeded mulberry32 stream — still
// spanning num_payments 1..480 including the 480-row extremes — at ~0.09 s
// instrumented; projected tier wall ~384 x (0.09 s + process spawn) / 2 + boot,
// far inside the 600 s bound); override with documented env PROPFLOOR_TRIAL_CAP,
// a positive integer, invalid values throw. The fixture oracle and P4
// ULP-boundary forcing are NEVER capped (mandatory, float_sensitive: YES).
// Every property is deterministic (seeded mulberry32), so a violation found
// under the cap is found under full trials too: kill-power can only be
// affected by violations that first surface on a late draw, quantified by the
// fixed named-mutant subset before/after comparison quoted on the row's PR.

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

// ---------- mutation-mode trial cap (ART332-MUTATION-TIER-COST-1; see header) ----------
const MUTATION_MODE =
  process.env.__STRYKER_ACTIVE_MUTANT__ !== undefined ||
  __dirname.replace(/\\/g, '/').includes('/ain-mutation-tier-');
let mutationTrials = 50; // default per-mutant cap; full trials remain the default outside the tier
if (process.env.PROPFLOOR_TRIAL_CAP !== undefined) {
  const cap = Number(process.env.PROPFLOOR_TRIAL_CAP);
  if (!Number.isInteger(cap) || cap <= 0) {
    throw new Error(`PROPFLOOR_TRIAL_CAP must be a positive integer, got "${process.env.PROPFLOOR_TRIAL_CAP}"`);
  }
  mutationTrials = cap;
}
const TRIALS = MUTATION_MODE ? mutationTrials : 4000;

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

// ---------- P5: caller-supplied schedule length is clamped at NUM_PAYMENTS_CAP=12000 ----------
// The cap flags must be COMPUTED from the requested counts, never static: absent at/below the
// boundary, present above it. The balloon path's nominal_amortization_periods is its own
// clamped loop bound (it drives the payment-size factor loop).
function checkP5_numPaymentsCap() {
  let violations = 0, checked = 0;
  // at the boundary the clamp is a no-op and NO cap flag is raised
  const atCap = compute({ schedule_type: 'level_payment', loan_amount: 1000, note_rate_pct: 0, num_payments: 12000, periods_per_year: 12 });
  checked++;
  if (atCap.output_payload.num_payments !== 12000 || atCap.output_payload.schedule.length !== 12000) violations++;
  if (atCap.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // one past the boundary: schedule clamped to 12000 and the cap flag IS raised
  const overCap = compute({ schedule_type: 'level_payment', loan_amount: 1000, note_rate_pct: 0, num_payments: 12001, periods_per_year: 12 });
  checked++;
  if (overCap.output_payload.num_payments !== 12000 || overCap.output_payload.schedule.length !== 12000) violations++;
  if (!overCap.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // small inputs unaffected: length preserved, no flag
  const small = compute({ schedule_type: 'level_payment', loan_amount: 300000, note_rate_pct: 6.5, num_payments: 60, periods_per_year: 12 });
  checked++;
  if (small.output_payload.num_payments !== 60 || small.output_payload.schedule.length !== 60) violations++;
  if (small.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // balloon: nominal_amortization_periods above the ceiling is clamped and flagged
  const balloonOver = compute({ schedule_type: 'balloon', loan_amount: 300000, note_rate_pct: 6.5, num_payments: 60, periods_per_year: 12, nominal_amortization_periods: 50000 });
  checked++;
  if (balloonOver.output_payload.nominal_amortization_periods !== 12000) violations++;
  if (!balloonOver.compliance_flags.includes('NOMINAL_AMORTIZATION_PERIODS_CAPPED')) violations++;
  if (balloonOver.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++; // num_payments=60 is under the ceiling; only the nominal clamp binds
  // balloon: default nominal (= num_payments) raises neither flag
  const balloonNominal = compute({ schedule_type: 'balloon', loan_amount: 300000, note_rate_pct: 6.5, num_payments: 60, periods_per_year: 12 });
  checked++;
  if (balloonNominal.compliance_flags.includes('NOMINAL_AMORTIZATION_PERIODS_CAPPED')) violations++;
  if (balloonNominal.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  return { name: 'P5_num_payments_and_nominal_clamped_flags_computed', trials: checked, violations };
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
results.properties.push(checkP5_numPaymentsCap());

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

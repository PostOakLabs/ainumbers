// art-215-reg-z-appendix-j-apr.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:11378014fd087d551a663ee640914801101ae04fd8a943a8d669314da98f2c88
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — bracketed-bisection iterative solver, the highest-risk convergence claim
// in this shard (WU-flagged). Checks: fixture-oracle gate, convergence-or-report stated per trial
// (never a silently-wrong rate), termination bound (iterations <= BISECT_STEPS=200 always),
// an independent differential re-derivation of the (b)(8) residual at the reported rate,
// and ULP-boundary forcing on the bracket-search edges (zero finance charge, unrepayable
// schedule, odd-days fraction at 0/near-1, denormal-scale loan amounts).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-215-reg-z-appendix-j-apr.proptest.mjs
//
// MUTATION-MODE TRIAL CAP (ART215-MUTATION-TIER-COST-1, test-side cost cut):
// Under the mutation tier (scripts/run-mutation-tier.mjs, Stryker 8.7.1 command
// runner) each of this kernel's 294 mutants (at authoring) re-runs this whole
// floor against Stryker's INSTRUMENTED kernel, and the instrumenter is the
// cost: the full-trial floor runs in ~4.6 s standalone (measured on this file,
// 2026-09-20) but the tier's initial dry run measured net 153878 ms on
// origin/main (reproduced on the row: "Ran 1 tests in 2 minutes 33 seconds
// (net 153878 ms)") — a ~33x instrumenter factor on the same ~12,000 compute()
// calls. Projection at full trials: 294 x ~157 s / 2 runners ~ 23,200 s, far
// past the 600 s per-kernel bound (MUTATION-TIER-HANG-MMS03-PNR01-1).
//
// Cost driver, measured (not guessed): compute() is a bracketed bisection
// whose residual loops run once per payment, so per-call cost is ~linear in
// num_payments — median 5 us at num_payments=6 vs 813 us at 360, generator
// range 6..360 (mean ~183). That closes the generator-range lever: fitting
// 294 mutants / 2 runners inside 600 s needs a per-pass ~3 s, i.e. a mean
// num_payments around 4 — BELOW the generator's own minimum of 6. The range
// would have to be amputated to a single point to move the bound, so the
// chosen lever is TRIAL COUNT, capped IN MUTATION MODE ONLY, detected two
// ways exactly as pnr-01 (PNR01-MUTATION-MC-COST-1): (a) the seam Stryker
// itself owns — CommandTestRunner.mutantRun() sets env __STRYKER_ACTIVE_MUTANT__
// for MUTANT runs; (b) the tier sandbox cwd — run-mutation-tier.mjs copies
// this proptest into %TEMP%\ain-mutation-tier-<pid>\ and runs the Stryker
// INITIAL DRY RUN there too, so __dirname under that root marks dry-run
// context (MEASURED on pnr-01 2026-09-14: leaving the dry run at FULL trials
// trips Stryker's own 300 s dryRunTimeout before any mutant runs, so the dry
// run must be capped too — the floor is still validated at FULL trials by
// this file's standalone repo-checkout run, outside the tier, where neither
// detection fires). Default cap 50 (~2 s instrumented per pass; projected
// tier wall ~294 x (1.9 s + process spawn) / 2 + boot ~ 430 s, inside the
// 600 s bound with margin); override with documented env PROPFLOOR_TRIAL_CAP,
// a positive integer, invalid values throw. The fixture oracle and P4
// ULP-boundary forcing are NEVER capped (mandatory, float_sensitive: YES).
// Every property is deterministic (seeded mulberry32; a capped run takes the
// first N draws of the same stream), so a violation found under the cap is
// found under full trials too: kill-power can only be affected by violations
// that first surface on a late draw, quantified by the fixed named-mutant
// subset before/after comparison quoted on the row's PR.

import { compute } from '../art-215-reg-z-appendix-j-apr.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-215-reg-z-appendix-j-apr.fixtures.json');
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
const rand = mulberry32(0x215A0);

const BISECT_STEPS = 200;

function randomLoan(rng) {
  const loan_amount = 1000 + rng() * 500000;
  const num_payments = 6 + Math.floor(rng() * 354);
  const periods_per_year = 12;
  // pick a target APR and back-solve an approximate level payment so the schedule
  // is (roughly) repaying — guarantees a positive-finance-charge, rate-dependent case.
  const targetRate = 0.001 + rng() * 0.03; // periodic rate 0.1%..3.1%
  const annuityFactor = (1 - Math.pow(1 + targetRate, -num_payments)) / targetRate;
  const payment_amount = Math.round((loan_amount / annuityFactor) * 100) / 100;
  return { loan_amount: Math.round(loan_amount * 100) / 100, payment_amount, num_payments, periods_per_year };
}

// Independent re-derivation of the (b)(8) residual, built directly from the fixture/kernel's
// own documented equation — NOT copy-pasted from the kernel's internal helpers.
function referenceResidual(loan_amount, payment_amount, num_payments, i) {
  let pvPayments = 0;
  for (let k = 1; k <= num_payments; k++) pvPayments += payment_amount / Math.pow(1 + i, k);
  return pvPayments - loan_amount;
}

// ---------- mutation-mode trial cap (ART215-MUTATION-TIER-COST-1; see header) ----------
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

// ---------- P1: convergence-or-report — never a silently-wrong rate ----------
function checkP1_convergenceOrReport() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = randomLoan(rand);
    const { output_payload: o } = compute(loan);
    checked++;
    if (o.bracketed && o.converged) {
      if (o.apr_pct === null || o.periodic_rate === null) violations++;
      if (!Number.isFinite(o.apr_pct) || !Number.isFinite(o.periodic_rate)) violations++;
    } else {
      // non-convergence MUST be reported, never masked
      if (o.apr_pct !== null || o.periodic_rate !== null) violations++;
    }
  }
  return { name: 'P1_convergence_or_report_never_silent', trials: checked, violations };
}

// ---------- P2: termination — iterations never exceed BISECT_STEPS ----------
function checkP2_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = randomLoan(rand);
    const { output_payload: o } = compute(loan);
    checked++;
    if (o.iterations > BISECT_STEPS) violations++;
    if (o.iterations < 0) violations++;
  }
  return { name: 'P2_termination_iterations_bounded', trials: checked, violations };
}

// Independent reference bisection (own loop, own bracket growth) — re-derives the rate from
// scratch using only the (b)(8) formula, so it cross-checks the kernel's solved rate rather
// than reusing the kernel's own bisection code.
function referenceSolve(loan_amount, payment_amount, num_payments) {
  let lo = 0, hi = 1e-9, found = false;
  let g0 = referenceResidual(loan_amount, payment_amount, num_payments, 0);
  if (g0 === 0) return 0;
  if (g0 < 0) return null;
  while (!found && hi <= 100) {
    const ghi = referenceResidual(loan_amount, payment_amount, num_payments, hi);
    if (!Number.isFinite(ghi)) break;
    if (ghi <= 0) { found = true; break; }
    lo = hi; hi *= 2;
  }
  if (!found) return null;
  for (let iters = 0; iters < 200 && (hi - lo) > 1e-12; iters++) {
    const mid = lo + (hi - lo) / 2;
    if (mid <= lo || mid >= hi) break;
    const gm = referenceResidual(loan_amount, payment_amount, num_payments, mid);
    if (!Number.isFinite(gm)) break;
    if (gm >= 0) lo = mid; else hi = mid;
  }
  return lo + (hi - lo) / 2;
}

// ---------- P3 (differential): kernel's converged rate matches an independently re-derived rate ----------
function checkP3_differentialRate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const loan = randomLoan(rand);
    const { output_payload: o } = compute(loan);
    if (!(o.bracketed && o.converged)) continue;
    checked++;
    const refRate = referenceSolve(loan.loan_amount, loan.payment_amount, loan.num_payments);
    if (refRate === null || !Number.isFinite(refRate)) { violations++; continue; }
    // both solvers narrow to <= 1e-6pp/ppy width; allow a generous relative+absolute tolerance
    const tol = Math.max(1e-4, refRate * 0.01);
    if (Math.abs(o.periodic_rate - refRate) > tol) violations++;
  }
  return { name: 'P3_differential_rate_matches_independent_bisection', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float:yes): bracket-search edges ----------
// ART215-MUTATION-TIER-COST-1: the boundary set now also HOLDS THE FLOOR TO the
// kernel's own documented edge behaviours, each assertion citing the kernel
// comment/spec line it asserts: PRE-7 (a schedule with no payment carried at a
// positive time has no rate dependence -> NO_RATE), PRE-8 (payments that cannot
// repay the advances -> no bracket -> never a rate), Appendix J (b)(7) time-form
// equivalence (odd_days 45/30 wraps to the SAME schedule as 15/30, negative
// odd_days normalises to 0, and the legacy {periods_from_consummation} flow form
// splits at the integer boundary — equivalent forms must be byte-identical), the
// documented num_payments clamp (Math.max(1, ...)), compute's documented
// explicit advances[]/payments[] input shape, and missing/NaN/Infinity inputs
// staying finite-or-null. Each case also pins the documented compliance_flags
// contract: APR_DID_NOT_CONVERGE on !converged, APR_NOT_BRACKETED on
// !bracketed, APR_NON_POSITIVE on a bracketed converged apr <= 0,
// APR_EXCEEDS_40_PCT_VERIFY on apr > 40 — and no flag where its trigger is
// absent. These are FIXED cases: ~15 extra computes per pass, deterministic,
// and NEVER subject to the mutation-mode trial cap (mandatory,
// float_sensitive: YES). Without them the tier measured money-math 146/266
// (54.9% < 60% floor): the surviving mutants are coverage gaps on exactly these
// documented edges, not late-draw draws, so trial count cannot buy the kills back.
function checkP4_ulpForcing() {
  let violations = 0, checked = 0;
  // exactFlags(arr) — the case's compliance_flags must equal EXACTLY arr.
  const exactFlags = (arr) => (o, f) => { if (JSON.stringify(f) !== JSON.stringify(arr)) violations++; };
  const NO_RATE_FLAGS = ['APR_DID_NOT_CONVERGE', 'APR_NOT_BRACKETED'];
  const cases = [
    { name: 'zero_finance_charge_single_payment', pp:
      // zero finance charge: single payment equal to advance -> g0 === 0 -> apr 0, converged
      { loan_amount: 1000, payment_amount: 1000, num_payments: 1, periods_per_year: 12 },
      spec: (o, f) => {
        if (o.apr_pct !== 0 || o.converged !== true || o.bracketed !== true) violations++;
        exactFlags(['APR_NON_POSITIVE'])(o, f); // bracketed, converged, apr <= 0
      } },
    { name: 'unrepayable_no_rate', pp:
      // unrepayable: total payments < advance -> g0 < 0 -> NO_RATE, must report non-convergence
      { loan_amount: 10000, payment_amount: 1, num_payments: 1, periods_per_year: 12 },
      spec: (o, f) => {
        if (o.apr_pct !== null || o.periodic_rate !== null || o.bracketed !== false || o.converged !== false) violations++;
        exactFlags(NO_RATE_FLAGS)(o, f);
      } },
    { name: 'degenerate_zero_amount_payments', pp:
      // degenerate non-rate-dependent schedule: zero-amount payments -> PRE-7 -> NO_RATE
      { loan_amount: 5000, payment_amount: 0, num_payments: 12, periods_per_year: 12 },
      spec: (o, f) => {
        if (o.apr_pct !== null || o.bracketed !== false) violations++;
        exactFlags(NO_RATE_FLAGS)(o, f);
      } },
    { name: 'odd_days_zero', pp:
      // odd-days fraction at exact 0 and near-1 boundary
      { loan_amount: 200000, payment_amount: 1264.14, num_payments: 360, periods_per_year: 12, odd_days: 0, unit_period_days: 30 },
      spec: exactFlags([]) },
    { name: 'odd_days_near_one', pp:
      { loan_amount: 200000, payment_amount: 1264.14, num_payments: 360, periods_per_year: 12, odd_days: 29.999999999, unit_period_days: 30 },
      spec: exactFlags([]) },
    { name: 'odd_days_wrap_one_and_a_half', pp:
      // (b)(7) wrap: 45/30 = 1.5 unit-periods -> 1 full period + 0.5 fraction
      { loan_amount: 200000, payment_amount: 1264.14, num_payments: 360, periods_per_year: 12, odd_days: 45, unit_period_days: 30 },
      spec: exactFlags([]) },
    { name: 'odd_days_half_equivalent', pp:
      // the SAME schedule priced as 15/30 — must be byte-identical to the wrapped form
      { loan_amount: 200000, payment_amount: 1264.14, num_payments: 360, periods_per_year: 12, odd_days: 15, unit_period_days: 30 },
      spec: exactFlags([]) },
    { name: 'odd_days_negative', pp:
      // negative odd_days must normalise to 0 (Math.max(0, ...)) — byte-identical to odd_days 0
      { loan_amount: 200000, payment_amount: 1264.14, num_payments: 360, periods_per_year: 12, odd_days: -15, unit_period_days: 30 },
      spec: exactFlags([]) },
    { name: 'denormal_scale_loan', pp:
      // denormal-scale loan amount
      { loan_amount: 1e-300, payment_amount: 1e-300, num_payments: 1, periods_per_year: 12 },
      spec: null },
    { name: 'negative_zero_loan', pp:
      // negative zero loan amount
      { loan_amount: -0, payment_amount: 100, num_payments: 12, periods_per_year: 12 },
      spec: null },
    { name: 'apr_exceeds_40', pp:
      // a steep schedule solving above 40% APR must raise the verify flag — and ONLY it
      { loan_amount: 1000, payment_amount: 300, num_payments: 6, periods_per_year: 12 },
      spec: (o, f) => {
        if (!(o.apr_pct > 40)) violations++;
        exactFlags(['APR_EXCEEDS_40_PCT_VERIFY'])(o, f);
      } },
    { name: 'explicit_schedule_legacy_flow_form', pp:
      // compute's documented explicit advances[]/payments[] input shape, with the
      // legacy {periods_from_consummation} flow form (normFlow splits it at the
      // integer boundary per (b)(7))
      { advances: [{ amount: 10000, full_periods: 0, fraction: 0 }], payments: [{ amount: 300, periods_from_consummation: 1.5 }, { amount: 300, periods_from_consummation: 2.5 }], periods_per_year: 12 },
      spec: (o) => { if (o.num_payments !== 2) violations++; } },
    { name: 'explicit_schedule_full_period_form', pp:
      // the SAME schedule as legacy_flow_form in the {full_periods, fraction} form — byte-identical
      { advances: [{ amount: 10000, full_periods: 0, fraction: 0 }], payments: [{ amount: 300, full_periods: 1, fraction: 0.5 }, { amount: 300, full_periods: 2, fraction: 0.5 }], periods_per_year: 12 },
      spec: (o) => { if (o.num_payments !== 2) violations++; } },
    { name: 'missing_fields_defaults', pp:
      // missing fields -> safeNum defaults; output stays well-formed
      {},
      spec: (o, f) => { if (o.num_payments !== 1) violations++; exactFlags(NO_RATE_FLAGS)(o, f); } },
    { name: 'null_fields_defaults', pp:
      { loan_amount: null, payment_amount: null, num_payments: null, periods_per_year: null },
      spec: (o, f) => { if (o.num_payments !== 1) violations++; exactFlags(NO_RATE_FLAGS)(o, f); } },
    { name: 'nan_negative_fields', pp:
      // NaN/Infinity/-5 inputs must clamp/defaults, never leak NaN into the payload
      { loan_amount: NaN, payment_amount: Infinity, num_payments: -5, periods_per_year: 12 },
      spec: (o, f) => { if (o.num_payments !== 1) violations++; exactFlags(NO_RATE_FLAGS)(o, f); } },
  ];
  const outs = {};
  for (const c of cases) {
    checked++;
    const { output_payload: o, compliance_flags: f } = compute(c.pp);
    outs[c.name] = o;
    // must always report a well-formed, finite-or-null result — never NaN/Infinity leak
    if (o.apr_pct !== null && !Number.isFinite(o.apr_pct)) violations++;
    if (o.periodic_rate !== null && !Number.isFinite(o.periodic_rate)) violations++;
    if (o.iterations > BISECT_STEPS || o.iterations < 0) violations++;
    if (typeof o.converged !== 'boolean' || typeof o.bracketed !== 'boolean') violations++;
    if (c.spec) c.spec(o, f);
  }
  // (b)(7) time-form equivalences: schedules that are the same flows at the same
  // times must produce byte-identical payloads (mutating the odd_frac wrap, the
  // negative-odd_days normalisation, the legacy-form split or the simple-interest
  // fraction factor breaks at least one identity).
  if (JSON.stringify(outs.odd_days_wrap_one_and_a_half) !== JSON.stringify(outs.odd_days_half_equivalent)) violations++;
  if (JSON.stringify(outs.odd_days_negative) !== JSON.stringify(outs.odd_days_zero)) violations++;
  if (JSON.stringify(outs.explicit_schedule_legacy_flow_form) !== JSON.stringify(outs.explicit_schedule_full_period_form)) violations++;
  return { name: 'P4_ulp_boundary_forcing_bracket_edges', trials: checked, violations };
}

// ---------- P5: caller-supplied schedule length is clamped at NUM_PAYMENTS_CAP=12000 ----------
// The cap flag must be COMPUTED from the requested count, never static: absent at/below the
// boundary, present above it, never raised by the >=1 floor, never raised on the explicit
// arrays path (the clamp guards the shorthand scalar only).
function checkP5_numPaymentsCap() {
  let violations = 0, checked = 0;
  // at the boundary the clamp is a no-op and NO cap flag is raised
  const atCap = compute({ loan_amount: 1000, payment_amount: 0, num_payments: 12000, periods_per_year: 12 });
  checked++;
  if (atCap.output_payload.num_payments !== 12000) violations++;
  if (atCap.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // one past the boundary: schedule clamped to 12000 and the cap flag IS raised
  const overCap = compute({ loan_amount: 1000, payment_amount: 0, num_payments: 12001, periods_per_year: 12 });
  checked++;
  if (overCap.output_payload.num_payments !== 12000) violations++;
  if (!overCap.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // small inputs unaffected: length preserved, no flag
  const small = compute({ loan_amount: 6000, payment_amount: 282.43, num_payments: 24, periods_per_year: 12 });
  checked++;
  if (small.output_payload.num_payments !== 24) violations++;
  if (small.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // explicit arrays path never raises the flag
  const explicit = compute({ advances: [{ amount: 1000, full_periods: 0, fraction: 0 }], payments: [{ amount: 100, full_periods: 12, fraction: 0 }], periods_per_year: 12 });
  checked++;
  if (explicit.output_payload.num_payments !== 1) violations++;
  if (explicit.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  // requested values that only trip the >=1 floor are not "capped"
  const floored = compute({ loan_amount: 1000, payment_amount: 100, num_payments: 0, periods_per_year: 12 });
  checked++;
  if (floored.output_payload.num_payments !== 1) violations++;
  if (floored.compliance_flags.includes('NUM_PAYMENTS_CAPPED')) violations++;
  return { name: 'P5_num_payments_clamped_cap_flag_computed', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_convergenceOrReport());
results.properties.push(checkP2_termination());
results.properties.push(checkP3_differentialRate());
results.properties.push(checkP4_ulpForcing());
results.properties.push(checkP5_numPaymentsCap());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-215-reg-z-appendix-j-apr',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

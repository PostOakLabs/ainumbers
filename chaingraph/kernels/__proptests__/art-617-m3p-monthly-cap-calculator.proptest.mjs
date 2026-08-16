// art-617-m3p-monthly-cap-calculator — class-A property-test FLOOR (fast CI sanity net).
// kernel_digest_at_authoring: sha256:406da22d96eb7425d67b6a82aee34eb6fcd1c504d7e9a3dc3a61ee50b1df7fc9
// spec: research/M3P-CAP-BUILD-1-SPEC.md
// human_sign_off: PENDING
//
// This is the fast CI-level floor. The full 4,830,023-state exhaustive class-A totality claim
// (M3P-CAP-BUILD-SPEC.md section 3 / FORMALVERIF-BUILD-SPEC.md section 6.A) lives at
// research/M3P-CAP-BUILD-1-enumeration-harness.mjs (workspace-root, run offline -- 12.17s at
// authoring, 4,830,023/4,830,023 PASS, research/M3P-CAP-BUILD-1-artifact.json). This floor covers
// the same rounding rule and domain shape by sampling, so it runs in CI in milliseconds.
//
// float_sensitive: yes (declared). The kernel itself resolves the rounding step with exact integer
// arithmetic (floor + remainder compare), never floating-point division -- PB2 below checks that
// against an INDEPENDENT closed-form restatement, round(a,b) = floor((2a+b)/(2b)), a different code
// shape from the kernel's own.
//
// oracle: "declared -- clause silent". 42 CFR 423.137 specifies no rounding rule for the division
// step; three CMS-sourced worked examples (423.137(b)(2), Final Part Two Guidance section 50.2 +
// footnote 38) are each consistent with round-half-up-to-the-cent, which is what this kernel
// declares and this floor asserts conformance to, never that the mode is abstractly "more correct".
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-617-m3p-monthly-cap-calculator.proptest.mjs

import { compute } from '../art-617-m3p-monthly-cap-calculator.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-617-m3p-monthly-cap-calculator';
const THRESHOLD = 210000;

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// Independent closed-form restatement of round-half-up on non-negative integers -- a different
// derivation shape from the kernel's own floor(a/b) + "2*remainder>=b" comparison.
function expectedCap(numeratorCents, monthsRemaining) {
  return Math.floor((2 * numeratorCents + monthsRemaining) / (2 * monthsRemaining));
}

// PA1: FIRST-MONTH ROUNDING CONFORMANCE — sampled numerator/months pairs, both branches derive from
// the same formula, checked against the independent closed-form restatement.
function checkPA1_firstMonthRoundingConformance() {
  const rng = mulberry32(617001);
  let checked = 0, violations = 0;
  for (let i = 0; i < 5000; i++) {
    const months = randInt(rng, 1, 12);
    const numerator = randInt(rng, 0, THRESHOLD);
    const incurred = THRESHOLD - numerator;
    const { output_payload } = compute({ branch: 'first_month', incurred_TrOOP_cents: incurred, months_remaining: months });
    checked++;
    if (!output_payload.valid_input) { violations++; continue; }
    if (output_payload.cap_cents !== expectedCap(numerator, months)) violations++;
    if (output_payload.numerator_cents !== numerator) violations++;
  }
  return { name: 'PA1_first_month_rounding_conformance', checked, violations };
}

// PA2: SUBSEQUENT-MONTH ROUNDING CONFORMANCE — same check, subsequent_month branch.
function checkPA2_subsequentMonthRoundingConformance() {
  const rng = mulberry32(617002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 5000; i++) {
    const months = randInt(rng, 1, 11);
    const numerator = randInt(rng, 0, THRESHOLD);
    const { output_payload } = compute({ branch: 'subsequent_month', remaining_owed_cents: numerator, newly_incurred_cents: 0, months_remaining: months });
    checked++;
    if (!output_payload.valid_input) { violations++; continue; }
    if (output_payload.cap_cents !== expectedCap(numerator, months)) violations++;
    if (output_payload.numerator_cents !== numerator) violations++;
  }
  return { name: 'PA2_subsequent_month_rounding_conformance', checked, violations };
}

// PA3: ADDEND-SPLIT INVARIANCE — cap_cents is invariant under how a subsequent_month numerator was
// split between remaining_owed_cents and newly_incurred_cents.
function checkPA3_addendSplitInvariance() {
  const rng = mulberry32(617003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 2000; i++) {
    const months = randInt(rng, 1, 11);
    const numerator = randInt(rng, 0, THRESHOLD);
    const remaining = randInt(rng, 0, numerator);
    const newly = numerator - remaining;
    const a = compute({ branch: 'subsequent_month', remaining_owed_cents: remaining, newly_incurred_cents: newly, months_remaining: months }).output_payload;
    const b = compute({ branch: 'subsequent_month', remaining_owed_cents: 0, newly_incurred_cents: numerator, months_remaining: months }).output_payload;
    checked++;
    if (a.cap_cents !== b.cap_cents) violations++;
  }
  return { name: 'PA3_addend_split_invariance', checked, violations };
}

// PA4: MONOTONE IN NUMERATOR — with months_remaining fixed, a larger numerator never produces a
// smaller cap.
function checkPA4_monotoneInNumerator() {
  const rng = mulberry32(617004);
  let checked = 0, violations = 0;
  for (let i = 0; i < 3000; i++) {
    const months = randInt(rng, 1, 12);
    const numLo = randInt(rng, 0, THRESHOLD - 1);
    const numHi = randInt(rng, numLo, THRESHOLD);
    const lo = compute({ branch: 'first_month', incurred_TrOOP_cents: THRESHOLD - numLo, months_remaining: months }).output_payload;
    const hi = compute({ branch: 'first_month', incurred_TrOOP_cents: THRESHOLD - numHi, months_remaining: months }).output_payload;
    checked++;
    if (hi.cap_cents < lo.cap_cents) violations++;
  }
  return { name: 'PA4_monotone_in_numerator', checked, violations };
}

// PA5: MONOTONE (DECREASING) IN MONTHS — with numerator fixed, more months remaining never
// increases the cap.
function checkPA5_monotoneDecreasingInMonths() {
  const rng = mulberry32(617005);
  let checked = 0, violations = 0;
  for (let i = 0; i < 3000; i++) {
    const numerator = randInt(rng, 0, THRESHOLD);
    const monthsLo = randInt(rng, 1, 11);
    const monthsHi = randInt(rng, monthsLo, 12);
    const lo = compute({ branch: 'first_month', incurred_TrOOP_cents: THRESHOLD - numerator, months_remaining: monthsLo }).output_payload;
    const hi = compute({ branch: 'first_month', incurred_TrOOP_cents: THRESHOLD - numerator, months_remaining: monthsHi }).output_payload;
    checked++;
    if (hi.cap_cents > lo.cap_cents) violations++;
  }
  return { name: 'PA5_monotone_decreasing_in_months', checked, violations };
}

// PA6: INVALID-DOMAIN REJECTION — out-of-range/malformed inputs are rejected, never silently
// clamped or coerced to a computed cap.
function checkPA6_invalidDomainRejection() {
  const rng = mulberry32(617006);
  let checked = 0, violations = 0;
  const badBranches = ['bogus', '', null, undefined, 'FIRST_MONTH', 'first-month', 42];
  for (const branch of badBranches) {
    const { output_payload } = compute({ branch, months_remaining: 1, incurred_TrOOP_cents: 0 });
    checked++;
    if (output_payload.valid_input !== false || output_payload.cap_cents !== null) violations++;
  }
  for (let i = 0; i < 1000; i++) {
    const overshoot = randInt(rng, THRESHOLD + 1, THRESHOLD + 100000);
    const { output_payload } = compute({ branch: 'first_month', incurred_TrOOP_cents: overshoot, months_remaining: 1 });
    checked++;
    if (output_payload.valid_input !== false || output_payload.cap_cents !== null) violations++;
  }
  for (let i = 0; i < 1000; i++) {
    const remaining = randInt(rng, 0, THRESHOLD);
    const newly = randInt(rng, THRESHOLD - remaining + 1, THRESHOLD);
    const { output_payload } = compute({ branch: 'subsequent_month', remaining_owed_cents: remaining, newly_incurred_cents: newly, months_remaining: 1 });
    checked++;
    if (output_payload.valid_input !== false || output_payload.cap_cents !== null) violations++;
  }
  for (const months of [0, -1, 13, 100]) {
    const { output_payload } = compute({ branch: 'first_month', incurred_TrOOP_cents: 0, months_remaining: months });
    checked++;
    if (output_payload.valid_input !== false || output_payload.cap_cents !== null) violations++;
  }
  for (const months of [0, -1, 12, 100]) {
    const { output_payload } = compute({ branch: 'subsequent_month', remaining_owed_cents: 0, newly_incurred_cents: 0, months_remaining: months });
    checked++;
    if (output_payload.valid_input !== false || output_payload.cap_cents !== null) violations++;
  }
  return { name: 'PA6_invalid_domain_rejection_never_silently_computed', checked, violations };
}

// PA7: DETERMINISM — recomputing the same policy_parameters yields a byte-identical payload.
function checkPA7_determinism() {
  const rng = mulberry32(617007);
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const branch = rng() < 0.5 ? 'first_month' : 'subsequent_month';
    const pp = branch === 'first_month'
      ? { branch, incurred_TrOOP_cents: randInt(rng, 0, THRESHOLD), months_remaining: randInt(rng, 1, 12) }
      : { branch, remaining_owed_cents: randInt(rng, 0, THRESHOLD), newly_incurred_cents: randInt(rng, 0, THRESHOLD), months_remaining: randInt(rng, 1, 11) };
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
  }
  return { name: 'PA7_determinism_on_recompute', checked, violations };
}

// PA8: OUTPUT SHAPE — no NaN/undefined/non-finite anywhere, including hostile inputs.
function checkPA8_outputShape() {
  let checked = 0, violations = 0;
  const hostile = [
    {}, null, undefined,
    { branch: 'first_month', incurred_TrOOP_cents: NaN, months_remaining: 1 },
    { branch: 'first_month', incurred_TrOOP_cents: Infinity, months_remaining: 1 },
    { branch: 'first_month', incurred_TrOOP_cents: 'not-a-number', months_remaining: 1 },
    { branch: 'subsequent_month', remaining_owed_cents: undefined, newly_incurred_cents: null, months_remaining: 1 },
    { branch: 'first_month', incurred_TrOOP_cents: 0, months_remaining: NaN },
    { branch: 'first_month', incurred_TrOOP_cents: 0, months_remaining: Infinity },
    { plan_year: 'twenty-twenty-six', branch: 'first_month', incurred_TrOOP_cents: 0, months_remaining: 1 },
  ];
  for (const pp of hostile) {
    checked++;
    let r;
    try { r = compute(pp); } catch { violations++; continue; }
    if (findShapeViolations(r.output_payload).length) violations++;
    if (typeof r.output_payload.valid_input !== 'boolean') violations++;
  }
  return { name: 'PA8_output_shape_no_nan_undefined_hostile_inputs', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkPA1_firstMonthRoundingConformance(),
  checkPA2_subsequentMonthRoundingConformance(),
  checkPA3_addendSplitInvariance(),
  checkPA4_monotoneInNumerator(),
  checkPA5_monotoneDecreasingInMonths(),
  checkPA6_invalidDomainRejection(),
  checkPA7_determinism(),
  checkPA8_outputShape(),
];
console.log(`[${KERNEL_ID}] class-A floor property test (42 CFR 423.137 M3P monthly cap, oracle: declared -- clause silent). Full exhaustive totality claim: research/M3P-CAP-BUILD-1-enumeration-harness.mjs.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);

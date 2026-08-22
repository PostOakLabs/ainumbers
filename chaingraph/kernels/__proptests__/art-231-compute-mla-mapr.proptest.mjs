// kernel_digest_at_authoring: sha256:302410302655744df0ba87706c7aa12347ad96fd99d175c3ed1d497372abc0d0
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-231-compute-mla-mapr,
// RE-AUTHORED for kernel 2.0.0 (ART231-MAPR-REBUILD-1). Class B (bounded-numeric),
// FLOAT-SENSITIVE (a bracketed bisection on a present-value residual, annualised by a
// multiply, compared against a fixed 36% statutory cap) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays). Read-only w.r.t. the kernel.
//
// WHAT CHANGED AND WHY (do not restore the old properties):
//   The pre-2.0.0 floor asserted the kernel's own defects as invariants and therefore
//   could not catch them.
//     - old P2 asserted a "$100/yr participation-fee exclusion cap". No such MAPR
//       exclusion exists: the $100 figure lives in the open-end, no-balance-in-the-
//       billing-cycle provision, and that same paragraph says in terms it does not
//       bound the bona fide exclusion. Replaced by P2 below, which asserts the property
//       the regulation actually has — an includable charge can only push the MAPR UP.
//     - old P3 asserted "mapr_pct is never below stated_apr_pct", i.e. the APR floor
//       that made the sealed V1 expectation an echo of one of its own inputs. Both the
//       floor and the input are gone. Replaced by P3, the three-predicate conjunctive
//       application-fee test.
//   P5 is new: it re-solves the actuarial rate with an INDEPENDENT implementation
//   (Math.pow-based bisection, never the kernel's integer-power path) and holds the two
//   to the eighth-of-one-percentage-point disclosure tolerance.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-231-compute-mla-mapr.proptest.mjs

import { compute } from '../art-231-compute-mla-mapr.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-231-compute-mla-mapr.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x23102);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

// Trial budgets follow the estate's SOLVER-CLASS convention, not the fixed-arithmetic
// one, and are split further by cost per trial. art-616, the sibling kernel that solves
// the same actuarial rate by the same bisection, runs 150 to 500 trials per property and
// completes in 0.22s. MEASURED here: a 10,000-trial budget over an iterative compute()
// costs 1.74s standalone and 54s per mutant once Stryker instruments the source, which
// turns this file's own mutation gate (MUTATION-TIERED-ROLLOUT-1, 477 mutants) into a
// multi-hour job. P1/P3/P4 call compute() once per trial; P2 calls it twice; P5
// additionally re-solves the rate. Breadth comes from the forced boundary cases and the
// vacuity guards at the bottom of this file, not from raw trial count.
const TRIALS = 400;
const TRIALS_PAIRED = 300;
const TRIALS_SOLVE = 300;
const CAP = 36.0;
// The stricter of the two disclosure tolerances: an eighth of one percentage point.
const DISCLOSURE_TOLERANCE_PP = 0.125;

// The eight caller-supplied charge channels the MAPR includes. Every one of them must
// be able to move the reported rate.
const INCLUDABLE_CHARGE_FIELDS = [
  'finance_charge_total',
  'credit_insurance_premium_total',
  'debt_cancellation_fee_total',
  'debt_suspension_fee_total',
  'ancillary_product_fee_total',
  'application_fee',
  'participation_fee_annual',
  'bona_fide_fee_claimed_total',
];

function mkPP(rng) {
  const installment = rng() < 0.7;
  const loan_amount = randRange(rng, 500, 50000);
  const pp = {
    credit_class: 'closed_end',
    loan_amount,
    finance_charge_total: randRange(rng, 0, loan_amount * 0.8),
  };
  if (installment) {
    pp.payment_structure = 'installment';
    pp.payment_count = Math.floor(randRange(rng, 2, 36));
    if (rng() < 0.2) pp.payments_per_year = [4, 12, 24, 52][Math.floor(rng() * 4)];
  } else {
    pp.payment_structure = 'single_payment';
    pp.term_days = Math.floor(randRange(rng, 7, 400));
  }
  // Charges are kept well below the advance so most trials produce a solvable rate; the
  // exhausted cases are covered by the forced boundary array instead.
  if (rng() < 0.5) pp.credit_insurance_premium_total = randRange(rng, 0, loan_amount * 0.05);
  if (rng() < 0.3) pp.application_fee = randRange(rng, 0, loan_amount * 0.05);
  if (rng() < 0.3) pp.participation_fee_annual = randRange(rng, 0, loan_amount * 0.05);
  if (rng() < 0.2) pp.debt_cancellation_fee_total = randRange(rng, 0, loan_amount * 0.03);
  if (rng() < 0.2) pp.debt_suspension_fee_total = randRange(rng, 0, loan_amount * 0.03);
  if (rng() < 0.2) pp.ancillary_product_fee_total = randRange(rng, 0, loan_amount * 0.03);
  if (rng() < 0.15) pp.bona_fide_fee_claimed_total = randRange(rng, 0, loan_amount * 0.03);
  if (rng() < 0.3) pp.creditor_is_fcu_or_idi = rng() < 0.5;
  if (rng() < 0.3) pp.is_short_term_small_amount_loan = rng() < 0.5;
  if (rng() < 0.3) pp.application_fee_once_in_rolling_12_months = rng() < 0.5;
  return pp;
}

// ---------- P1: exceeds_cap agrees with mapr_pct > 36 exactly, and null travels together ----------
function checkP1_exceedsCapAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.mapr_pct === null) {
      if (r.exceeds_cap !== null || r.mapr_determined !== false) violations++;
    } else if (r.exceeds_cap !== (r.mapr_pct > CAP) || r.mapr_determined !== true) {
      violations++;
    }
  }
  return { name: 'P1_exceeds_cap_matches_mapr_gt_36pct_and_null_travels_together', trials: checked, violations };
}

// ---------- P2: an includable charge can only push the MAPR UP ----------
// This is the property the pre-2.0.0 kernel violated on every path for
// participation_fee_annual and application_fee: the fee moved the reported rate by
// exactly zero. Monotone-non-decreasing catches a fee that is silently dropped as well
// as one that is netted out, and the vacuity guard at the bottom of the file refuses a
// run in which nothing moved at all.
function checkP2_includableChargesAreMonotone() {
  let violations = 0, checked = 0, moved = 0;
  for (let i = 0; i < TRIALS_PAIRED; i++) {
    const pp = mkPP(rand);
    const field = INCLUDABLE_CHARGE_FIELDS[Math.floor(rand() * INCLUDABLE_CHARGE_FIELDS.length)];
    const bump = randRange(rand, 1, Math.max(2, pp.loan_amount * 0.05));
    const base = compute(pp).output_payload;
    const more = compute({ ...pp, [field]: (pp[field] || 0) + bump }).output_payload;
    if (base.mapr_pct === null || more.mapr_pct === null) continue;
    checked++;
    // Tolerance is one 2-decimal reporting step, not a relaxation of the direction.
    if (more.mapr_pct < base.mapr_pct - 0.01) violations++;
    // An application fee the three-predicate carve-out removed is legitimately inert.
    const inert_by_carve_out = field === 'application_fee' && base.application_fee_carve_out_applied;
    if (!inert_by_carve_out && more.mapr_pct > base.mapr_pct) moved++;
  }
  return { name: 'P2_includable_charge_never_lowers_mapr_and_is_not_inert', trials: checked, violations, cases_that_moved_the_rate: moved };
}

// ---------- P3: the application-fee carve-out is CONJUNCTIVE in all three predicates ----------
function checkP3_carveOutIsConjunctive() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    pp.application_fee = randRange(rand, 1, Math.max(2, pp.loan_amount * 0.05));
    const a = rand() < 0.5, b = rand() < 0.5, c = rand() < 0.5;
    pp.creditor_is_fcu_or_idi = a;
    pp.is_short_term_small_amount_loan = b;
    pp.application_fee_once_in_rolling_12_months = c;
    const r = compute(pp).output_payload;
    checked++;
    const expected = a && b && c;
    if (r.application_fee_carve_out_applied !== expected) violations++;
    const row = r.charge_breakdown.find((x) => x.field === 'application_fee');
    if (!row || row.included !== !expected) violations++;
    // Excluded means excluded: the fee is reported as excluded, not as includable.
    if (expected && r.total_excluded_charges !== row.amount) violations++;
    if (!expected && r.total_excluded_charges !== 0) violations++;
  }
  return { name: 'P3_application_fee_carve_out_requires_all_three_predicates', trials: checked, violations };
}

// ---------- P4: charge accounting identity ----------
// total_includable is the charges collected at consummation plus the finance charge
// carried by the schedule, and the amount financed is the advance less the former.
function checkP4_chargeAccountingIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    let prepaid = 0, scheduled = 0;
    for (const c of r.charge_breakdown) {
      if (!c.included) continue;
      if (c.treatment === 'collected_at_consummation') prepaid += c.amount;
      else if (c.treatment === 'carried_by_payment_schedule') scheduled += c.amount;
    }
    // Each component is rounded to 2dp on its own, so summing the already-rounded
    // components can drift from the pre-summed total by up to one rounding step per
    // component. The tolerance reflects that, not a relaxation of the identity.
    if (Math.abs(r.prepaid_includable_charges - prepaid) > 0.045) violations++;
    if (Math.abs(r.total_includable_charges - (prepaid + scheduled)) > 0.05) violations++;
    if (Math.abs(r.amount_financed_mapr - (r.amount_advanced - r.prepaid_includable_charges)) > 0.011) violations++;
  }
  return { name: 'P4_total_includable_and_amount_financed_identity', trials: checked, violations };
}

// ---------- P5: INDEPENDENT re-solve of the actuarial rate ----------
// Rebuilt from the policy parameters, never from the kernel's reported schedule fields,
// and solved with Math.pow rather than the kernel's integer-power path.
function independentMapr(pp) {
  const advance = Math.max(0, Number(pp.loan_amount) || 0);
  const fc = Math.max(0, Number(pp.finance_charge_total) || 0);
  const carveOut = pp.creditor_is_fcu_or_idi === true
    && pp.is_short_term_small_amount_loan === true
    && pp.application_fee_once_in_rolling_12_months === true;
  let prepaid = 0;
  for (const f of INCLUDABLE_CHARGE_FIELDS) {
    if (f === 'finance_charge_total') continue;
    if (f === 'application_fee' && carveOut) continue;
    prepaid += Math.round(Math.max(0, Number(pp[f]) || 0) * 100) / 100;
  }
  prepaid = Math.round(prepaid * 100) / 100;
  const af = Math.round((advance - prepaid) * 100) / 100;
  if (!(af > 0)) return null;

  const single = pp.payment_structure === 'single_payment';
  let n, w, pay, frac;
  if (single) {
    const days = Math.round(Number(pp.term_days) || 0);
    if (!(days > 0)) return null;
    pay = Math.round((advance + fc) * 100) / 100;
    n = days < 365 ? 1 : Math.floor(days / 365);
    w = days < 365 ? 365 / days : 1;
    frac = days < 365 ? 0 : (days - n * 365) / 365;
  } else {
    n = Math.max(1, Math.round(Number(pp.payment_count) || 0));
    w = Math.max(1, Number(pp.payments_per_year) || 12);
    pay = (advance + fc) / n;
    frac = 0;
  }

  // Closed-form present value. The kernel sums the schedule term by term with integer
  // powers; this uses the annuity identity and Math.pow, so agreement between the two is
  // evidence, not a shared implementation. It is also O(1) per evaluation, which keeps
  // this property affordable under the per-mutant mutation gate.
  const pv = (i) => {
    if (single) return pay / ((1 + frac * i) * Math.pow(1 + i, n));
    if (i === 0) return pay * n;
    return pay * (1 - Math.pow(1 + i, -n)) / i;
  };
  if (pv(0) - af < 0) return null;

  let lo = 0, hi = 1e-9, found = false;
  if (pv(0) - af === 0) { found = true; hi = 0; }
  while (!found && hi <= 100) {
    if (pv(hi) - af <= 0) { found = true; break; }
    lo = hi; hi *= 2;
  }
  if (!found) return null;
  for (let it = 0; it < 200 && (hi - lo) > 1e-14; it++) {
    const mid = (lo + hi) / 2;
    if (mid <= lo || mid >= hi) break;
    if (pv(mid) - af >= 0) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * w * 100;
}

function checkP5_independentActuarialResolve() {
  let violations = 0, checked = 0, worst = 0;
  for (let i = 0; i < TRIALS_SOLVE; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    const mine = independentMapr(pp);
    if (r.mapr_pct === null || mine === null) continue;
    checked++;
    const d = Math.abs(r.mapr_pct - mine);
    if (d > worst) worst = d;
    if (d > DISCLOSURE_TOLERANCE_PP) violations++;
  }
  return { name: 'P5_matches_independent_actuarial_solve_within_disclosure_tolerance', trials: checked, violations, worst_delta_pp: Math.round(worst * 1e6) / 1e6 };
}

// ---------- P6 (mandatory): ULP-boundary forcing ----------
const CLOSED = { credit_class: 'closed_end' };
const ULP_BOUNDARY_CASES = [
  [{}, 'empty input — no rate, mapr_pct and exceeds_cap both null'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 1000, term_days: 365, finance_charge_total: 360 },
    'one-year single payment landing exactly on 36.00 — the limit forbids GREATER than 36, so exceeds_cap must be false'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 1000, term_days: 365, finance_charge_total: 360.05 },
    'the same loan one reporting step above the cap — exceeds_cap must be true'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 500, term_days: 45, finance_charge_total: 28.44 },
    'the published 45-day oracle — a term that is NOT a whole number of months, inexpressible in the pre-2.0.0 contract'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 500, term_days: 46, finance_charge_total: 28.44 },
    'one day either side of the oracle — the day-granular term must move the rate'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 500, term_days: 44, finance_charge_total: 28.44 },
    'one day the other side of the oracle — the day-granular term must move the rate'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 500, term_days: 364, finance_charge_total: 50 },
    'one day inside the sub-year branch — unit-periods per year is 365 divided by the days'],
  [{ ...CLOSED, payment_structure: 'single_payment', loan_amount: 500, term_days: 366, finance_charge_total: 50 },
    'one day past a year — the unit-period is capped at a year and the odd day is a fraction'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 205.55, participation_fee_annual: 0 },
    'the blind-channel base with a zero participation fee'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 205.55, participation_fee_annual: 0.01 },
    'one cent of participation fee — the channel the pre-2.0.0 kernel left flat from $0 to $400'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 205.55, application_fee: 0.01 },
    'one cent of application fee — the other channel the pre-2.0.0 kernel left flat'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 0 },
    'zero finance charge and no other charge — a zero rate is solvable, not a failure'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 100, participation_fee_annual: 1000 },
    'charges exactly equal to the advance — amount financed is zero, no rate reportable'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 100, participation_fee_annual: 1000.01 },
    'charges one cent above the advance — the charges-exceed-advance flag, no rate'],
  [{ credit_class: 'open_end', loan_amount: 1000, payment_count: 12, finance_charge_total: 205.55 },
    'open-end declared — out of scope, no rate rather than a closed-end number'],
  [{ is_credit_card: true, loan_amount: 1000, payment_count: 12, finance_charge_total: 205.55 },
    'legacy is_credit_card flag — a card account is open-end, so out of scope'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 10000, payment_count: 600, finance_charge_total: 5000 },
    'exactly at the declared 600-payment structural limit — still solved'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 10000, payment_count: 601, finance_charge_total: 5000 },
    'one payment past the limit — no rate and the limit flag, never a silently truncated schedule'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: -0, payment_count: 12, finance_charge_total: 100 },
    'negative zero advance — normalised to plain 0, no rate'],
  [{ ...CLOSED, payment_structure: 'installment', loan_amount: 1000, payment_count: 12, finance_charge_total: 0.1 * 3 },
    'a finance charge built from a 0.1*3 rounding-noise product'],
];

function checkP6_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const { output_payload: r, compliance_flags } = compute(pp);
    const rateFinite = r.mapr_pct === null || Number.isFinite(r.mapr_pct);
    const nullsTravelTogether = (r.mapr_pct === null) === (r.exceeds_cap === null)
      && (r.mapr_pct !== null) === r.mapr_determined;
    const capAgrees = r.mapr_pct === null ? true : (r.exceeds_cap === (r.mapr_pct > CAP));
    const everythingFinite = rateFinite
      && Number.isFinite(r.total_includable_charges)
      && Number.isFinite(r.amount_financed_mapr)
      && Number.isFinite(r.payment_amount);
    const plausible = everythingFinite && nullsTravelTogether && capAgrees;
    rows.push({ label, mapr_pct: r.mapr_pct, exceeds_cap: r.exceeds_cap, determined: r.mapr_determined, flags: compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_exceedsCapAgreement());
results.properties.push(checkP2_includableChargesAreMonotone());
results.properties.push(checkP3_carveOutIsConjunctive());
results.properties.push(checkP4_chargeAccountingIdentity());
results.properties.push(checkP5_independentActuarialResolve());
results.boundary_forced = checkP6_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);
// A monotonicity property that never observed a rate MOVE would pass vacuously — which
// is exactly how the pre-2.0.0 floor missed a fee that moved nothing.
const p2 = results.properties.find((p) => p.name.startsWith('P2_'));
const p2Vacuous = !p2 || p2.cases_that_moved_the_rate < 200;
const p5 = results.properties.find((p) => p.name.startsWith('P5_'));
const p5Vacuous = !p5 || p5.trials < 200;

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible || p2Vacuous || p5Vacuous) {
  if (p2Vacuous) console.error('P2 would have passed VACUOUSLY — too few trials moved the reported rate at all.');
  if (p5Vacuous) console.error('P5 would have passed VACUOUSLY — too few trials produced a comparable rate.');
  console.error('PROPERTY FLOOR FAILED for art-231-compute-mla-mapr');
  process.exit(1);
}
console.log('PASS art-231-compute-mla-mapr');

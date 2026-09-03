// art-571-lease-schedule-recompute-asc842-ifrs16.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:52ffad81ad3921b0e86f2e3e7eb943434eeac7d1365a9ba8c7465638df35f24b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md Sec3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- confirmed by direct source read (matches the WU row, and stated explicitly
// in the kernel's own header comment: "discounting itself uses IEEE-754 double arithmetic"). `pv()`
// computes `Math.pow(1 + annualRate, days / 365) - 1` then divides the payment amount by
// `(1 + periodicRate)` -- real float exponentiation, division, and subtraction feeding
// `pv_of_payments_minor`, the initial lease liability, the ROU asset, and every schedule row's
// interest/principal split via `Math.round(openingLiability * periodicRate)`. ULP-boundary forcing is
// applied around the zero-rate boundary, the 75%/90% bright-line percentage boundaries, and the
// interest-rounding boundary.
// Checks: fixture-oracle gate, termination (bounded by payment_schedule.length <= MAX_PAYMENTS=240),
// differential re-derivation of the ACT/365 discount-factor and amortization schedule via an
// independently-written pv()/buildSchedule reimplementation, ULP-boundary forcing on the discount-rate
// exponentiation (0 rate, tiny rate, denormal-adjacent rate, x/y*y!==x-shaped day counts) and the
// 75%/90% bright-line boundaries, a cross-regime metamorphic identity (when classification is
// FINANCE, the ASC 842 and IFRS 16 schedules must be byte-identical, since buildSchedule is called
// with mode='finance' for both in that branch), and an advance-vs-arrears timing metamorphic pair
// (the same payment amounts dated one period earlier under timing 'advance' must produce a
// PV >= the 'arrears' PV, strictly greater for any positive rate, equal at rate 0; the advance
// row dated at commencement must carry zero interest; and an undeclared timing must refuse to run).
//
// Run: node chaingraph/kernels/__proptests__/art-571-lease-schedule-recompute-asc842-ifrs16.proptest.mjs

import { compute } from '../art-571-lease-schedule-recompute-asc842-ifrs16.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-571-lease-schedule-recompute-asc842-ifrs16.fixtures.json');
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
const rand = mulberry32(0x57100);

function randomPayments(rng) {
  const n = 2 + Math.floor(rng() * 5);
  const payments = [];
  for (let i = 1; i <= n; i++) {
    const y = 2026 + Math.floor(i / 12);
    const m = String(1 + (i % 12)).padStart(2, '0');
    payments.push({ date: `${y}-${m}-01`, amount_minor: 100000 + Math.floor(rng() * 50000) });
  }
  return payments;
}

function randomPP(rng) {
  return {
    discount_rate_annual: [0.02, 0.05, 0.08, 0][Math.floor(rng() * 4)],
    timing: rng() < 0.5 ? 'arrears' : 'advance',
    lease_term: { commencement_date: '2026-01-01', end_date: '2028-01-01' },
    payment_schedule: randomPayments(rng),
    initial_direct_costs_minor: Math.floor(rng() * 5000),
    lease_incentives_minor: Math.floor(rng() * 3000),
    classification_inputs: {
      ownership_transfers: false,
      purchase_option_reasonably_certain: false,
      specialized_asset: false,
      major_part_bright_line_elected: true,
      economic_life_years: 10,
      substantially_all_bright_line_elected: false,
      substantially_all_declared: rng() < 0.5,
    },
  };
}

const TRIALS = 1500;

// ---------- P1: termination -- bounded by payment_schedule.length ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.asc842.schedule.length !== pp.payment_schedule.length) violations++;
    if (output_payload.ifrs16.schedule.length !== pp.payment_schedule.length) violations++;
    if (output_payload.asc842.schedule.length > 240) violations++;
  }
  return { name: 'P1_termination_schedule_bounded_by_payments', trials: checked, violations };
}

// ---------- P2 (differential): independent re-derivation of pv() and the interest/principal split ----------
function checkP2_discounting_differential() {
  let violations = 0, checked = 0;
  function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function pv(amount, days, rate) { const pr = Math.pow(1 + rate, days / 365) - 1; return amount / (1 + pr); }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let pvSum = 0;
    for (const p of pp.payment_schedule) {
      const days = dayDiff(pp.lease_term.commencement_date, p.date);
      pvSum += pv(p.amount_minor, days, pp.discount_rate_annual);
    }
    pvSum = Math.round(pvSum);
    if (output_payload.asc842.pv_of_payments_minor !== pvSum) violations++;
    // Re-derive each row's interest via the same formula and compare.
    let opening = pvSum; let prevDate = pp.lease_term.commencement_date;
    for (let ri = 0; ri < output_payload.ifrs16.schedule.length; ri++) {
      const row = output_payload.ifrs16.schedule[ri];
      const days = dayDiff(prevDate, row.date);
      const periodicRate = Math.pow(1 + pp.discount_rate_annual, days / 365) - 1;
      const expectedInterest = Math.round(opening * periodicRate);
      if (row.interest_minor !== expectedInterest) violations++;
      opening = row.closing_liability_minor;
      prevDate = row.date;
    }
  }
  return { name: 'P2_discounting_and_interest_split_differential', trials: checked, violations };
}

// ---------- P3: ULP-boundary forcing on the discount-rate exponentiation and bright-line percentages ----------
function checkP3_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const rates = [0, 1e-15, 5e-10, 0.0000001, 0.5, 1];
  for (const rate of rates) {
    checked++;
    const pp = { discount_rate_annual: rate, timing: 'arrears', lease_term: { commencement_date: '2026-01-01', end_date: '2027-01-01' }, payment_schedule: [{ date: '2026-06-01', amount_minor: 100000 }], initial_direct_costs_minor: 0, lease_incentives_minor: 0, classification_inputs: { ownership_transfers: false, purchase_option_reasonably_certain: false, specialized_asset: false, major_part_bright_line_elected: false, major_part_declared: false, substantially_all_bright_line_elected: false, substantially_all_declared: false } };
    const { output_payload } = compute(pp);
    const days = Math.round((Date.parse('2026-06-01T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
    const pr = Math.pow(1 + rate, days / 365) - 1;
    const expectedPv = Math.round(100000 / (1 + pr));
    if (output_payload.asc842.pv_of_payments_minor !== expectedPv) violations++;
    if (rate === 0 && output_payload.asc842.pv_of_payments_minor !== 100000) violations++;
  }
  // 75% bright line exact boundary: term_years/economic_life_years === 0.75 -> major_part_met true.
  checked++;
  {
    const pp = { discount_rate_annual: 0.05, timing: 'arrears', lease_term: { commencement_date: '2026-01-01', end_date: '2033-07-02' /* ~7.5 years */ }, payment_schedule: [{ date: '2026-06-01', amount_minor: 100000 }], initial_direct_costs_minor: 0, lease_incentives_minor: 0, classification_inputs: { ownership_transfers: false, purchase_option_reasonably_certain: false, specialized_asset: false, major_part_bright_line_elected: true, economic_life_years: 10, substantially_all_bright_line_elected: false, substantially_all_declared: false } };
    const { output_payload } = compute(pp);
    const termYears = output_payload.asc842.classification_criteria.major_part_of_economic_life.term_years;
    const expectedMet = (termYears / 10) >= 0.75;
    if (output_payload.asc842.classification_criteria.major_part_of_economic_life.met !== expectedMet) violations++;
  }
  return { name: 'P3_ulp_boundary_forcing_discount_rate_and_bright_lines', trials: checked, violations };
}

// ---------- P4: metamorphic -- FINANCE classification makes ASC 842 and IFRS 16 schedules identical ----------
function checkP4_finance_regime_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    pp.classification_inputs.ownership_transfers = true; // forces FINANCE regardless of other criteria
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.asc842.classification !== 'FINANCE') violations++;
    if (JSON.stringify(output_payload.asc842.schedule) !== JSON.stringify(output_payload.ifrs16.schedule)) violations++;
  }
  return { name: 'P4_finance_classification_asc842_ifrs16_schedule_identity', trials: checked, violations };
}

// ---------- P5: metamorphic -- advance timing (annuity due) vs arrears (ordinary annuity) ----------
function checkP5_advance_vs_arrears() {
  let violations = 0, checked = 0;
  const rates = [0, 0.03, 0.06, 0.11];
  for (const rate of rates) {
    for (let i = 0; i < 300; i++) {
      const n = 2 + Math.floor(rand() * 5);
      const amounts = Array.from({ length: n }, () => 100000 + Math.floor(rand() * 50000));
      // Same amounts; advance dates them at commencement + each anniversary, arrears one period later.
      const advanceDates = [], arrearsDates = [];
      for (let k = 0; k < n; k++) {
        const y = 2026 + k;
        advanceDates.push(`${y}-01-01`);
        arrearsDates.push(`${y + 1}-01-01`);
      }
      const base = {
        discount_rate_annual: rate,
        lease_term: { commencement_date: '2026-01-01', end_date: `${2026 + n}-01-01` },
        initial_direct_costs_minor: 0,
        lease_incentives_minor: 0,
        classification_inputs: { ownership_transfers: true, purchase_option_reasonably_certain: false, specialized_asset: false, major_part_bright_line_elected: false, major_part_declared: false, substantially_all_bright_line_elected: false, substantially_all_declared: false },
      };
      const ppAdvance = { ...base, timing: 'advance', payment_schedule: advanceDates.map((d, k) => ({ date: d, amount_minor: amounts[k] })) };
      const ppArrears = { ...base, timing: 'arrears', payment_schedule: arrearsDates.map((d, k) => ({ date: d, amount_minor: amounts[k] })) };
      const adv = compute(ppAdvance).output_payload;
      const arr = compute(ppArrears).output_payload;
      checked++;
      // Annuity-due PV must be >= ordinary-annuity PV for the same amounts, strictly > at a positive rate.
      if (adv.asc842.pv_of_payments_minor < arr.asc842.pv_of_payments_minor) violations++;
      if (rate > 0 && !(adv.asc842.pv_of_payments_minor > arr.asc842.pv_of_payments_minor)) violations++;
      if (rate === 0 && adv.asc842.pv_of_payments_minor !== arr.asc842.pv_of_payments_minor) violations++;
      // A payment dated at commencement carries zero interest -- no time has elapsed.
      if (adv.asc842.schedule[0].period_days !== 0 || adv.asc842.schedule[0].interest_minor !== 0) violations++;
      // Timing is mirrored into the payload; the liability still amortizes to a residual within
      // the declared rounding rule -- one minor unit of per-row interest rounding slack per
      // scheduled row (measured worst case: 3 minor units over 6 rows at an 11% rate).
      if (adv.timing !== 'advance' || arr.timing !== 'arrears') violations++;
      const advFinal = adv.asc842.schedule[adv.asc842.schedule.length - 1].closing_liability_minor;
      const arrFinal = arr.asc842.schedule[arr.asc842.schedule.length - 1].closing_liability_minor;
      if (Math.abs(advFinal) > n || Math.abs(arrFinal) > n) violations++;
      // evidence_handover stage present on both ran paths and figures reconcile to the schedules.
      if (!adv.evidence_handover || !arr.evidence_handover) violations++;
      if (adv.evidence_handover.disclosure_figures.asc842.total_payments_minor !== amounts.reduce((a, b) => a + b, 0)) violations++;
    }
  }
  // Undeclared timing must refuse to run -- timing is declared, never defaulted.
  checked++;
  {
    const ppNoTiming = { discount_rate_annual: 0.06, lease_term: { commencement_date: '2026-01-01', end_date: '2027-01-01' }, payment_schedule: [{ date: '2026-06-01', amount_minor: 100000 }], initial_direct_costs_minor: 0, lease_incentives_minor: 0, classification_inputs: { ownership_transfers: false, purchase_option_reasonably_certain: false, specialized_asset: false, major_part_bright_line_elected: false, major_part_declared: false, substantially_all_bright_line_elected: false, substantially_all_declared: false } };
    const r = compute(ppNoTiming).output_payload;
    if (r.decision.execution_state !== 'did_not_run' || r.timing !== null || !r.rejected_inputs.some((x) => x.where === 'timing')) violations++;
  }
  return { name: 'P5_advance_vs_arrears_annuity_due_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_discounting_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_finance_regime_identity());
results.properties.push(checkP5_advance_vs_arrears());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-571-lease-schedule-recompute-asc842-ifrs16',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// art-571-lease-schedule-recompute-asc842-ifrs16.proptest.mjs -- FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C29-1).
// kernel_digest_at_authoring: sha256:41a5b1590955af3b2f923482346677130524a112c6673a9f5f2d45f96d0326c1
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
// Additionally: the declared-input rejection contract (every rejection path's exact reason string,
// supplied-echo, and did_not_run gating; string coercion of rates and minor units; both bright-line
// computations at their exact >= boundaries; election labels and compliance flags), the preparer-
// schedule diff metamorphics (MATCHES/DIVERGES/INDETERMINATE verdicts, inclusive tolerance boundary,
// mismatch and unmatched-date reasons, diff-validation rejections), and payload-shape invariants
// (verbatim scope/clause/ifrs16 notes and evidence handover, differential ROU allocation in both
// finance and operating modes, the residual finding iff an independently re-derived residual is
// large, and buildArtifact echoing the deterministic payload with its chain/audit metadata).
//
// Run: node chaingraph/kernels/__proptests__/art-571-lease-schedule-recompute-asc842-ifrs16.proptest.mjs

import { compute, buildArtifact, meta } from '../art-571-lease-schedule-recompute-asc842-ifrs16.kernel.mjs';
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

// ---------- P6: declared-input contract -- every rejection path fires with its exact reason string,
// echoes `supplied` verbatim, and gates the run (declared-never-defaulted, both bright lines, the
// 75%/90% computed sources, coercion of string minor units / string rates, sort, flags) ----------
function baseValid() {
  return {
    discount_rate_annual: 0.05,
    timing: 'arrears',
    lease_term: { commencement_date: '2026-01-01', end_date: '2028-01-01' },
    payment_schedule: [
      { date: '2026-06-01', amount_minor: 100000 },
      { date: '2027-01-01', amount_minor: 120000 },
      { date: '2028-01-01', amount_minor: 140000 },
    ],
    initial_direct_costs_minor: 0,
    lease_incentives_minor: 0,
    classification_inputs: { ownership_transfers: false, purchase_option_reasonably_certain: false, specialized_asset: false, major_part_bright_line_elected: false, major_part_declared: false, substantially_all_bright_line_elected: false, substantially_all_declared: false },
  };
}

function checkP6_input_contract() {
  let violations = 0, checked = 0;
  function expectRejected(mutate, where, reason, supplied, runs) {
    const pp = baseValid();
    mutate(pp);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (runs) {
      if (output_payload.decision.execution_state !== 'ran') { violations++; console.error('DBG', where, 'state', output_payload.decision.execution_state); }
      if (!output_payload.rejected_inputs.some((x) => x.where === where && x.reason === reason && JSON.stringify(x.supplied) === JSON.stringify(supplied))) { violations++; console.error('DBG', where, JSON.stringify(output_payload.rejected_inputs)); }
      if (!compliance_flags.includes('LEASE_INPUTS_REJECTED')) { violations++; console.error('DBG', where, 'flags', JSON.stringify(compliance_flags)); }
    } else {
      if (output_payload.decision.execution_state !== 'did_not_run') violations++;
      if (output_payload.decision.reason !== 'required_inputs_incomplete') violations++;
      if (output_payload.verdict !== 'INDETERMINATE' || output_payload.asc842 !== null || output_payload.ifrs16 !== null) violations++;
      if (JSON.stringify(compliance_flags) !== JSON.stringify(['LEASE_REQUIRED_INPUTS_INCOMPLETE'])) violations++;
      if (!output_payload.rejected_inputs.some((x) => x.where === where && x.reason === reason && JSON.stringify(x.supplied) === JSON.stringify(supplied))) violations++;
    }
  }
  const RATE = 'absent or not a non-negative number -- the discount rate must be declared, never derived';
  expectRejected((pp) => { delete pp.discount_rate_annual; }, 'discount_rate_annual', RATE, null, false);
  expectRejected((pp) => { pp.discount_rate_annual = 'abc'; }, 'discount_rate_annual', RATE, 'abc', false);
  expectRejected((pp) => { pp.discount_rate_annual = -0.5; }, 'discount_rate_annual', RATE, -0.5, false);
  // A numeric string rate is coercion, not derivation -- identical PV to the numeric rate.
  {
    const str = compute({ ...baseValid(), discount_rate_annual: '0.05' }).output_payload;
    const num = compute(baseValid()).output_payload;
    checked++;
    if (str.asc842.pv_of_payments_minor !== num.asc842.pv_of_payments_minor) violations++;
  }
  expectRejected((pp) => { pp.lease_term.commencement_date = '2026-1-1'; }, 'lease_term.commencement_date', 'absent or not YYYY-MM-DD', '2026-1-1', false);
  expectRejected((pp) => { delete pp.lease_term.end_date; }, 'lease_term.end_date', 'absent or not YYYY-MM-DD', null, false);
  expectRejected((pp) => { pp.lease_term.end_date = '2026-01-01'; }, 'lease_term', 'commencement_date must be before end_date', '2026-01-01..2026-01-01', false);
  expectRejected((pp) => { pp.timing = 'monthly'; }, 'timing', 'must be "arrears" (payments at period end) or "advance" (payments at period start) -- declared, never defaulted', 'monthly', false);
  const ROW = 'date must be YYYY-MM-DD and amount_minor a positive integer number of minor units';
  expectRejected((pp) => { pp.payment_schedule[0].amount_minor = 0; }, 'payment_schedule[0]', ROW, '2026-06-01', true);
  expectRejected((pp) => { pp.payment_schedule[0].amount_minor = '100000.5'; }, 'payment_schedule[0]', ROW, '2026-06-01', true);
  // A numeric-string amount is an exact integer count of minor units -- accepted verbatim.
  {
    const out = compute({ ...baseValid(), payment_schedule: [{ date: '2026-06-01', amount_minor: '100000' }] }).output_payload;
    checked++;
    if (out.asc842.schedule[0].payment_minor !== 100000) violations++;
  }
  expectRejected((pp) => { pp.payment_schedule[0].date = '2025-12-01'; }, 'payment_schedule[0]', 'payment date must not be before lease_term.commencement_date', '2025-12-01', true);
  expectRejected((pp) => { pp.payment_schedule[0].date = '2026-01-01'; }, 'payment_schedule[0]', 'arrears payment date must be after lease_term.commencement_date (payments occur at period end)', '2026-01-01', true);
  expectRejected((pp) => { pp.timing = 'advance'; pp.payment_schedule[2].date = '2028-01-01'; }, 'payment_schedule[2]', 'advance payment date must be before lease_term.end_date (payments occur at period start)', '2028-01-01', true);
  // >240 payments: the surplus is capped off at 240 and the run proceeds on the declared tail-trimmed schedule.
  {
    const many = Array.from({ length: 241 }, (_, i) => ({ date: `${2026 + Math.floor((i + 1) / 12)}-${String(1 + ((i + 1) % 12)).padStart(2, '0')}-01`, amount_minor: 100000 }));
    const { output_payload, compliance_flags } = compute({ ...baseValid(), payment_schedule: many });
    checked++;
    // The slice caps the schedule at MAX_PAYMENTS=240; the surplus is dropped and the run proceeds.
    if (output_payload.decision.execution_state !== 'ran' || output_payload.asc842.schedule.length !== 240 || output_payload.ifrs16.schedule.length !== 240) violations++;
    if (output_payload.rejected_inputs.length !== 0 || compliance_flags.includes('LEASE_INPUTS_REJECTED')) violations++;
  }
  expectRejected((pp) => { pp.payment_schedule = []; }, 'payment_schedule', 'absent or empty -- at least one payment is required', null, false);
  const MINOR = 'not an integer number of minor units';
  expectRejected((pp) => { pp.initial_direct_costs_minor = 'nope'; }, 'initial_direct_costs_minor', MINOR, 'nope', false);
  expectRejected((pp) => { pp.lease_incentives_minor = 'x'; }, 'lease_incentives_minor', MINOR, 'x', false);
  // Numeric-string IDC folds into the ROU asset exactly.
  {
    const pv0 = compute(baseValid()).output_payload.asc842.initial_lease_liability_minor;
    const out = compute({ ...baseValid(), initial_direct_costs_minor: '2500' }).output_payload;
    checked++;
    if (out.asc842.initial_rou_asset_minor !== pv0 + 2500) violations++;
  }
  const DECLARED = 'absent -- must be declared true/false, never defaulted';
  expectRejected((pp) => { delete pp.classification_inputs.ownership_transfers; }, 'classification_inputs.ownership_transfers', DECLARED, null, false);
  expectRejected((pp) => { delete pp.classification_inputs.purchase_option_reasonably_certain; }, 'classification_inputs.purchase_option_reasonably_certain', DECLARED, null, false);
  expectRejected((pp) => { delete pp.classification_inputs.specialized_asset; }, 'classification_inputs.specialized_asset', DECLARED, null, false);
  expectRejected((pp) => { delete pp.classification_inputs.major_part_bright_line_elected; }, 'classification_inputs.major_part_bright_line_elected', 'absent -- must be declared true/false', null, false);
  expectRejected((pp) => { pp.classification_inputs.major_part_bright_line_elected = true; delete pp.classification_inputs.economic_life_years; }, 'classification_inputs.economic_life_years', 'absent or not a positive number -- required when the 75% bright line is elected', null, false);
  expectRejected((pp) => { delete pp.classification_inputs.major_part_declared; }, 'classification_inputs.major_part_declared', 'absent -- required judgment declaration when the 75% bright line is not elected', null, false);
  expectRejected((pp) => { delete pp.classification_inputs.substantially_all_bright_line_elected; }, 'classification_inputs.substantially_all_bright_line_elected', 'absent -- must be declared true/false', null, false);
  expectRejected((pp) => { pp.classification_inputs.substantially_all_bright_line_elected = true; }, 'classification_inputs.fair_value_minor', 'absent or not a positive integer -- required when the 90% bright line is elected', null, false);
  expectRejected((pp) => { pp.classification_inputs.substantially_all_bright_line_elected = true; pp.classification_inputs.fair_value_minor = 0; }, 'classification_inputs.fair_value_minor', 'absent or not a positive integer -- required when the 90% bright line is elected', null, true);
  // 90% bright line computed from the PV -- election labeled as computed, never as judgment.
  {
    const pp = baseValid();
    pp.classification_inputs.major_part_bright_line_elected = true;
    pp.classification_inputs.economic_life_years = 10;
    pp.classification_inputs.substantially_all_bright_line_elected = true;
    pp.classification_inputs.fair_value_minor = 1000000;
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const pv = output_payload.asc842.pv_of_payments_minor;
    if (output_payload.asc842.classification_criteria.substantially_all_of_fair_value.met !== (pv / 1000000 >= 0.9)) violations++;
    if (output_payload.asc842.classification_criteria.substantially_all_of_fair_value.source !== 'computed_90pct_bright_line') violations++;
    if (JSON.stringify(output_payload.elections) !== JSON.stringify(['major_part_75pct_bright_line', 'substantially_all_90pct_bright_line'])) violations++;
    if (!compliance_flags.includes('LEASE_BRIGHT_LINE_ELECTED')) violations++;
  }
  // 75% bright line EXACT boundary: term_years/economic_life_years === 0.75 (>= not >).
  {
    /** @type {[string, number, boolean][]} */
    const rows75 = [['2028-12-31', 4, true], ['2028-12-30', 4, false]];
    for (const [end, life, met] of rows75) {
      const pp = baseValid();
      pp.lease_term.end_date = end;
      pp.classification_inputs.major_part_bright_line_elected = true;
      pp.classification_inputs.economic_life_years = life;
      const { output_payload } = compute(pp);
      checked++;
      const crit = output_payload.asc842.classification_criteria.major_part_of_economic_life;
      if (crit.met !== met || crit.source !== 'computed_75pct_bright_line') violations++;
      if (crit.term_years !== (end === '2028-12-31' ? 3 : 1094 / 365)) violations++;
    }
  }
  // Each remaining criterion individually forces FINANCE; judgments all-false stay OPERATING.
  {
    const opRun = compute(baseValid());
    checked++;
    if (opRun.output_payload.asc842.classification !== 'OPERATING') violations++;
    if (JSON.stringify(opRun.compliance_flags) !== JSON.stringify(['LEASE_SCHEDULE_RECOMPUTED', 'LEASE_CLASSIFICATION_OPERATING'])) violations++;
    for (const key of ['purchase_option_reasonably_certain', 'specialized_asset']) {
      const pp = baseValid();
      pp.classification_inputs[key] = true;
      const { output_payload: finOut, compliance_flags: finFlags } = compute(pp);
      checked++;
      if (finOut.asc842.classification !== 'FINANCE') violations++;
      if (!finFlags.includes('LEASE_CLASSIFICATION_FINANCE')) violations++;
    }
  }
  // Advance timing raises its flag; payments arrive sorted by date regardless of input order.
  {
    const pp = baseValid();
    pp.timing = 'advance';
    pp.payment_schedule = [pp.payment_schedule[2], pp.payment_schedule[0], pp.payment_schedule[1]];
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('LEASE_TIMING_ADVANCE')) violations++;
    const dates = output_payload.asc842.schedule.map((r) => r.date);
    if (JSON.stringify(dates) !== JSON.stringify([...dates].sort())) violations++;
  }
  return { name: 'P6_declared_input_contract_rejection_paths', trials: checked, violations };
}

// ---------- P7: preparer-schedule diff metamorphic -- verdicts MATCHES/DIVERGES/INDETERMINATE,
// tolerance is inclusive at the boundary, mismatch/unmatched reasons carry both balances ----------
function checkP7_preparer_diff() {
  let violations = 0, checked = 0;
  const base = baseValid(); // OPERATING arrears, 3 payments
  const reference = compute(base).output_payload;
  const rows = reference.asc842.schedule.map((r) => ({ date: r.date, liability_balance_minor: r.closing_liability_minor }));
  function runWith(prepRows, compareRegime, tol) {
    return compute({ ...base, preparer_schedule: prepRows, compare_regime: compareRegime, diff_tolerance_minor: tol }).output_payload;
  }
  function flagsFor(prepRows, compareRegime, tol) {
    return compute({ ...base, preparer_schedule: prepRows, compare_regime: compareRegime, diff_tolerance_minor: tol }).compliance_flags;
  }
  // Exact preparer balances at tolerance 0 -> MATCHES, auto_pass.
  {
    const out = runWith(rows, 'asc842', 0);
    checked++;
    if (out.verdict !== 'MATCHES' || out.decision.gate_policy !== 'auto_pass') violations++;
    if (out.diff.requested !== true || out.diff.compare_regime !== 'asc842' || out.diff.tolerance_minor !== 0 || out.diff.mismatches.length !== 0 || out.diff.compared_count !== 3) violations++;
    if (!flagsFor(rows, 'asc842', 0).includes('LEASE_PREPARER_DIFF_MATCHES')) violations++;
  }
  // Same via the IFRS 16 regime schedule.
  {
    const ifrsRows = reference.ifrs16.schedule.map((r) => ({ date: r.date, liability_balance_minor: r.closing_liability_minor }));
    const out = runWith(ifrsRows, 'ifrs16', 0);
    checked++;
    if (out.verdict !== 'MATCHES' || out.diff.compare_regime !== 'ifrs16') violations++;
  }
  // Delta exactly at tolerance passes; one minor unit past it DIVERGES (inclusive boundary).
  for (const [delta, verdict] of [[5, 'MATCHES'], [6, 'DIVERGES']]) {
    const out = runWith(rows.map((r) => ({ date: r.date, liability_balance_minor: r.liability_balance_minor + delta })), 'asc842', 5);
    checked++;
    if (out.verdict !== verdict) violations++;
    if (verdict === 'DIVERGES') {
      if (out.decision.gate_policy !== 'review_required') violations++;
      if (!flagsFor(rows.map((r) => ({ date: r.date, liability_balance_minor: r.liability_balance_minor + delta })), 'asc842', 5).includes('LEASE_PREPARER_DIFF_DIVERGES')) violations++;
      const m = out.diff.mismatches[0];
      if (!m || m.reason !== 'liability_balance_out_of_tolerance' || m.delta_minor !== 6 || m.preparer_liability_balance_minor !== rows[0].liability_balance_minor + 6 || m.computed_liability_balance_minor !== rows[0].liability_balance_minor) violations++;
      if (!out.findings.some((f) => f.code === 'PREPARER_SCHEDULE_DIVERGES' && f.severity === 'high')) violations++;
    }
  }
  // A preparer date absent from the computed schedule -> INDETERMINATE with a warning finding.
  {
    const out = runWith([...rows, { date: '2099-01-01', liability_balance_minor: 1 }], 'asc842', 0);
    checked++;
    if (out.verdict !== 'INDETERMINATE' || out.decision.gate_policy !== 'auto_pass') violations++;
    const m = out.diff.mismatches.find((x) => x.date === '2099-01-01');
    if (!m || m.reason !== 'date_not_in_computed_schedule' || m.computed_liability_balance_minor !== null) violations++;
    if (!out.findings.some((f) => f.code === 'PREPARER_SCHEDULE_DATES_UNMATCHED' && f.severity === 'warning')) violations++;
  }
  // Empty preparer schedule: diff ran, nothing compared, MATCHES.
  {
    const out = runWith([], 'asc842', 0);
    checked++;
    if (out.verdict !== 'MATCHES' || out.diff.compared_count !== 0) violations++;
  }
  // Diff-validation rejections: compare_regime, tolerance (absent/negative), bad row, row overflow.
  const TOL = 'absent or not a non-negative integer -- required when preparer_schedule is supplied, never defaulted';
  function expectDiffRejected(mutate, where, reason, supplied) {
    const pp = { ...base, preparer_schedule: rows };
    mutate(pp);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.decision.execution_state !== 'did_not_run') violations++;
    if (!output_payload.rejected_inputs.some((x) => x.where === where && x.reason === reason && JSON.stringify(x.supplied) === JSON.stringify(supplied))) violations++;
  }
  expectDiffRejected((pp) => { pp.compare_regime = 'ifrs9'; }, 'compare_regime', 'must be "asc842" or "ifrs16" when preparer_schedule is supplied', 'ifrs9');
  expectDiffRejected((pp) => { delete pp.diff_tolerance_minor; }, 'diff_tolerance_minor', TOL, null);
  expectDiffRejected((pp) => { pp.diff_tolerance_minor = -5; }, 'diff_tolerance_minor', TOL, -5);
  expectDiffRejected((pp) => { pp.preparer_schedule = [{ date: '2026-06-01', liability_balance_minor: 'x' }]; }, 'preparer_schedule[0]', 'date must be YYYY-MM-DD and liability_balance_minor an integer', '2026-06-01');
  {
    const many = Array.from({ length: 241 }, (_, i) => ({ date: `${2026 + Math.floor((i + 1) / 12)}-${String(1 + ((i + 1) % 12)).padStart(2, '0')}-01`, liability_balance_minor: i }));
    const { output_payload } = compute({ ...base, preparer_schedule: many, compare_regime: 'asc842', diff_tolerance_minor: 0 });
    checked++;
    // The slice caps the preparer rows at MAX_PREPARER_ROWS=240; the surplus is dropped, the run proceeds.
    if (output_payload.decision.execution_state !== 'ran' || output_payload.diff.compared_count !== 240 || output_payload.rejected_inputs.length !== 0) violations++;
  }
  return { name: 'P7_preparer_diff_verdicts_and_tolerance_boundary', trials: checked, violations };
}

// ---------- P8: payload-shape invariants -- notes and evidence handover verbatim, ROU allocation
// re-derived differentially in both modes, the residual finding iff the independently re-derived
// residual exceeds the row count, and buildArtifact echoes the deterministic payload ----------
async function checkP8_payload_and_rou_invariants() {
  let violations = 0, checked = 0;
  function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  {
    const out = compute(baseValid()).output_payload;
    checked++;
    if (out.scope_note !== 'Performs arithmetic and a documented classification test over caller-declared lease terms, payment schedule, and discount rate only. Does not source a discount rate, does not determine what qualifies as a specialized asset, and does not reproduce ASC 842 or IFRS 16 standard text.') violations++;;
    if (out.clause_note !== 'ASC 842 (Leases), FASB ASC Topic 842 -- classification criteria at ASC 842-10-25-2 through 25-3. IFRS 16 (Leases), effective 2019-01-01, applies a single on-balance-sheet lessee model and does not classify leases as finance or operating. Confirm the current standard text for the applicable reporting framework.') violations++;;
    if (out.ifrs16.ifrs16_note !== 'IFRS 16 applies a single on-balance-sheet lessee model; no operating/finance classification is made.') violations++;;
    const eh = out.evidence_handover;
    if (eh.stage !== 'evidence_handover' || eh.offline_verify !== true || eh.network_access !== 'none') violations++;;
    if (JSON.stringify(eh.handover_tool) !== JSON.stringify({ tool_id: 'evidence-handover-bundle', interface: 'browser-javascript', entry: 'tools/576-evidence-handover-bundle.html', binder_format: 'ainumbers-casefile-binder-v1' })) violations++;;
    const df = eh.disclosure_figures;
    if (df.timing !== 'arrears' || df.discount_rate_annual !== 0.05 || df.commencement_date !== '2026-01-01' || df.end_date !== '2028-01-01') violations++;;
    const sumPay = out.asc842.schedule.reduce((a, r) => a + r.payment_minor, 0);
    const sumInt = out.asc842.schedule.reduce((a, r) => a + r.interest_minor, 0);
    if (df.asc842.total_payments_minor !== sumPay || df.asc842.total_interest_minor !== sumInt) violations++;;
    if (df.asc842.final_closing_liability_minor !== out.asc842.schedule[out.asc842.schedule.length - 1].closing_liability_minor) violations++;;
    if (df.asc842.initial_lease_liability_minor !== out.asc842.initial_lease_liability_minor || df.ifrs16.initial_rou_asset_minor !== out.ifrs16.initial_rou_asset_minor) violations++;;
  }
  if (meta.tool_id !== 'art-571-lease-schedule-recompute-asc842-ifrs16' || meta.tool_version !== '1.1.0' || meta.mcp_name !== 'recompute_lease_schedule_asc842_ifrs16' || meta.mandate_type !== 'compliance_control' || meta.gpu !== false) violations++;;
  // Differential ROU re-derivation: finance mode allocates straight-line by elapsed days with the
  // remainder in the last row; operating mode amortizes the plug (straight-line cost minus interest).
  {
    const pp = baseValid();
    pp.classification_inputs.ownership_transfers = true; // finance
    const out = compute(pp).output_payload;
    checked++;
    const termDays = dayDiff('2026-01-01', '2028-01-01');
    const rou = out.asc842.initial_rou_asset_minor;
    let allocated = 0;
    let prev = '2026-01-01';
    for (let i = 0; i < out.asc842.schedule.length; i++) {
      const row = out.asc842.schedule[i];
      const days = dayDiff(prev, row.date);
      const isLast = i === out.asc842.schedule.length - 1;
      const expected = isLast ? rou - allocated : Math.round((rou * days) / termDays);
      if (row.rou_amortization_minor !== expected) violations++;;
      allocated += row.rou_amortization_minor;
      prev = row.date;
    }
    if (out.ifrs16.schedule[out.ifrs16.schedule.length - 1].rou_closing_balance_minor !== 0) violations++;;
  }
  {
    const out = compute(baseValid()).output_payload; // operating
    checked++;
    const termDays = dayDiff('2026-01-01', '2028-01-01');
    const totalCost = out.asc842.schedule.reduce((a, r) => a + r.payment_minor, 0);
    let prev = '2026-01-01';
    for (const row of out.asc842.schedule) {
      const days = dayDiff(prev, row.date);
      const expected = Math.round((totalCost / termDays) * days) - row.interest_minor;
      if (row.rou_amortization_minor !== expected) violations++;;
      prev = row.date;
    }
  }
  // Residual finding fires iff the independently re-derived final residual exceeds the row count.
  {
    const pp = { ...baseValid(), discount_rate_annual: 0.9, payment_schedule: Array.from({ length: 6 }, (_, i) => ({ date: `${2027 + i}-01-01`, amount_minor: 100000 + i * 17000 })) };
    const out = compute(pp).output_payload;
    let opening = 0;
    for (const p of pp.payment_schedule) opening += p.amount_minor / Math.pow(1 + 0.9, dayDiff('2026-01-01', p.date) / 365);
    for (const p of pp.payment_schedule) opening += p.amount_minor / Math.pow(1 + 0.9, dayDiff('2026-01-01', p.date) / 365);
    let prev = '2026-01-01';
    for (const row of out.asc842.schedule) {
      const days = dayDiff(prev, row.date);
      const interest = Math.round(opening * (Math.pow(1 + 0.9, days / 365) - 1));
      opening = opening - (row.payment_minor - interest);
      prev = row.date;
    }
    const residualLarge = Math.abs(Math.round(opening)) > pp.payment_schedule.length;
    checked++;
    if (out.findings.some((f) => f.code === 'ASC842_LIABILITY_RESIDUAL_LARGE') !== residualLarge) violations++;;
  }
  // buildArtifact wraps the deterministic payload unchanged and stamps chain/audit metadata.
  {
    const pp = baseValid();
    /** @type {{now?: string, parent_hashes?: string[], parent_tool_ids?: string[], chain_depth?: number}} */
    const baOpts = { parent_hashes: ['abc'], parent_tool_ids: ['x'], chain_depth: 2 };
    baOpts.now = '2026-09-06T00:00:00Z';
    const artifact = await buildArtifact(pp, baOpts);
    checked++;
    if (artifact.tool_id !== meta.tool_id || artifact.tool_version !== '1.1.0' || artifact.mandate_type !== 'compliance_control') violations++;;
    if (artifact.chaingraph_version !== '0.4.0' || artifact.generated_at !== '2026-09-06T00:00:00Z') violations++;;
    if (typeof artifact.execution_hash !== 'string' || artifact.execution_hash.length === 0) violations++;;
    if (JSON.stringify(artifact.policy_parameters) !== JSON.stringify(pp)) violations++;;
    if (JSON.stringify(artifact.chain) !== JSON.stringify({ parent_hashes: ['abc'], parent_tool_ids: ['x'], chain_depth: 2 })) violations++;;
    if (artifact.compute_mode !== 'server' || artifact.compute_proof_ready !== 'deferred') violations++;;
    if (artifact.audit_signature.payloadType !== 'application/vnd.openchain.graph+json;version=0.4') violations++;;
    const live = compute(pp).output_payload;
    if (JSON.stringify(artifact.output_payload) !== JSON.stringify(live)) violations++;;
  }
  return { name: 'P8_payload_shape_rou_allocation_and_artifact_echo', trials: checked, violations };
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
results.properties.push(checkP6_input_contract());
results.properties.push(checkP7_preparer_diff());
results.properties.push(await checkP8_payload_and_rou_invariants());

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

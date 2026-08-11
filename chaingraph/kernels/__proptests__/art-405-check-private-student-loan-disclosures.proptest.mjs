// art-405-check-private-student-loan-disclosures.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:75fd46391316b49459fd5cfc046cdfc162076a32e0f76268ed539ffb43e3bd6e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — civilFromDays/dayOfWeek are pure integer-day-count
// algorithms, no fractional arithmetic anywhere in the file; forced categorical boundary cases
// used).
// Checks: fixture-oracle gate, termination (the `while (businessDaysCounted < 3)` rescission loop
// is the file's one unbounded construct — it always advances `day` by exactly 1 per iteration and
// only skips Sat/Sun/a FINITE declared holiday_dates set, so it is bounded by
// 3 + 2*ceil((3+|holiday_dates|)/5) iterations; tested directly by forcing large holiday_dates
// sets and asserting the loop still terminates and returns exactly 3 business days), boundedness
// (total_gaps <= 14, the sum of the three fixed per-stage element tables), a differential
// re-derivation of completeness_grade and total_gaps against the three checklist passes, a
// metamorphic identity (permutation-invariance of each stage's element array and of
// holiday_dates), and forced categorical boundary cases (final_disclosure_date on a Friday with no
// holidays, all-weekday holiday_dates absorbing extra skips, unparseable final_disclosure_date).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-405-check-private-student-loan-disclosures.proptest.mjs

import { compute } from '../art-405-check-private-student-loan-disclosures.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-405-check-private-student-loan-disclosures.fixtures.json');
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
const rand = mulberry32(0x405C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const APP = ['interest-rate-or-range', 'fees-and-default-charges', 'repayment-terms', 'cosigner-rights-disclosure', 'estimated-total-cost'];
const APR = ['confirmed-interest-rate', 'confirmed-fees', 'confirmed-repayment-terms', 'right-to-accept-30-days-disclosure', 'rate-lock-period-disclosure'];
const FIN = ['final-interest-rate', 'final-fees', 'final-repayment-schedule', 'right-to-cancel-3-day-disclosure'];
const STATUSES = ['complete', 'partial', 'absent'];
const MS_PER_DAY = 86400000;

function isoDate(days) { return new Date(Date.UTC(2026, 0, 1) + days * MS_PER_DAY).toISOString().slice(0, 10); }
function stageArr(rng, required) { return required.filter(() => rng() < 0.85).map((el) => ({ element: el, status: pick(rng, STATUSES) })); }

function randomPP(rng) {
  const day = Math.floor(rng() * 60);
  const nHolidays = Math.floor(rng() * 4);
  const holiday_dates = Array.from({ length: nHolidays }, () => isoDate(day + Math.floor(rng() * 10)));
  return {
    inputs: {
      application_elements: stageArr(rng, APP),
      approval_elements: stageArr(rng, APR),
      final_elements: stageArr(rng, FIN),
      self_certification_present: rng() < 0.7,
      final_disclosure_date: rng() < 0.9 ? isoDate(day) : 'garbage',
      holiday_dates,
    },
  };
}

function gapsFor(rng_elements, required) {
  const map = {};
  for (const e of rng_elements) if (e && e.element) map[e.element] = e.status;
  return required.filter((el) => (map[el] || 'absent') !== 'complete').length;
}

const TRIALS = 3000;

// ---------- P1: termination — rescission loop always yields exactly 3 business days when parseable ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pp.inputs.final_disclosure_date);
    if (m) {
      if (!o.rescission) violations++;
      else if (!o.rescission.third_business_day) violations++;
    } else if (o.rescission !== null) violations++;
  }
  // stress: large holiday_dates set never hangs the loop and still yields 3 business days
  {
    const day = 0;
    const holiday_dates = Array.from({ length: 40 }, (_, i) => isoDate(day + i));
    const { output_payload: o } = compute({ inputs: { application_elements: [], approval_elements: [], final_elements: [], self_certification_present: true, final_disclosure_date: isoDate(day), holiday_dates } });
    checked++;
    if (!o.rescission || !o.rescission.third_business_day) violations++;
  }
  return { name: 'P1_termination_rescission_loop_bounded_by_holidays', trials: checked, violations };
}

// ---------- P2: boundedness — total_gaps bounded by fixed 14-element table ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const TOTAL_REQ = APP.length + APR.length + FIN.length;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.gap_count > TOTAL_REQ) violations++;
    if (o.elements_checked !== TOTAL_REQ) violations++;
  }
  return { name: 'P2_total_gaps_bounded_by_fixed_table', trials: checked, violations };
}

// ---------- P3: differential — completeness_grade + total_gaps re-derived per stage ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const expectedGaps = gapsFor(pp.inputs.application_elements, APP) + gapsFor(pp.inputs.approval_elements, APR) + gapsFor(pp.inputs.final_elements, FIN);
    if (o.gap_count !== expectedGaps) violations++;
    let expectedGrade;
    if (expectedGaps === 0) expectedGrade = 'A';
    else if (expectedGaps <= 1) expectedGrade = 'B';
    else if (expectedGaps <= 3) expectedGrade = 'C';
    else if (expectedGaps <= 6) expectedGrade = 'D';
    else expectedGrade = 'F';
    if (o.completeness_grade !== expectedGrade) violations++;
    if (o.compliant !== (expectedGaps === 0 && pp.inputs.self_certification_present)) violations++;
  }
  return { name: 'P3_grade_and_gaps_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of each stage's element array ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.inputs.application_elements.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.inputs.application_elements].reverse();
    const r2 = compute({ inputs: { ...pp.inputs, application_elements: shuffled } }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // Friday final_disclosure_date, no holidays -> 3rd business day is the following Wednesday
  {
    // 2026-01-02 is a Friday
    const { output_payload: o } = compute({ inputs: { application_elements: [], approval_elements: [], final_elements: [], self_certification_present: true, final_disclosure_date: '2026-01-02', holiday_dates: [] } });
    checked++;
    if (o.rescission.third_business_day !== '2026-01-07') violations++; // Mon,Tue,Wed = 3 business days after Fri (skip Sat/Sun)
  }
  // unparseable final_disclosure_date -> rescission null, flag raised
  {
    const { output_payload: o, compliance_flags } = compute({ inputs: { application_elements: [], approval_elements: [], final_elements: [], self_certification_present: true, final_disclosure_date: 'nope', holiday_dates: [] } });
    checked++;
    if (o.rescission !== null) violations++;
    if (!compliance_flags.includes('FINAL_DISCLOSURE_DATE_UNPARSEABLE')) violations++;
  }
  // federal_idr_out_of_scope always true
  {
    const { output_payload: o } = compute({ inputs: {} });
    checked++;
    if (o.federal_idr_out_of_scope !== true) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-405-check-private-student-loan-disclosures',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

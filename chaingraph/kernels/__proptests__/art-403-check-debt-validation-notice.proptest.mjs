// art-403-check-debt-validation-notice.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:7587d455f6bdc2449925d27d42cc07a2660c799f4670d238cb0793af19d274fa
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — response_period math is pure integer-day
// arithmetic: toUtcMidnight/civilFromDays/addDaysIso are hand-rolled integer algorithms over
// epoch-day counts, never a fractional division; forced categorical boundary cases used).
// Checks: fixture-oracle gate, termination (gap_count bounded by the fixed 10-element
// REQUIRED_ELEMENTS table — a single linear walk, no recursion), boundedness (gaps.length ===
// gap_count, elements_checked fixed), a differential re-derivation of completeness_grade and the
// response_period deadline math (assumed_received_date = mailed + mailing_assumption_days,
// dispute_deadline_date = assumed_received + 30) against an independent Date-based reimplementation,
// a metamorphic identity (permutation-invariance of notice_elements order, keyed by unique element
// id), and forced categorical boundary cases (unparseable mailing date, itemization date after
// mailing date, mailing_assumption_days negative clamped to declared default handling, zero-day
// assumption).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-403-check-debt-validation-notice.proptest.mjs

import { compute } from '../art-403-check-debt-validation-notice.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-403-check-debt-validation-notice.fixtures.json');
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
const rand = mulberry32(0x403C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const REQUIRED_ELEMENTS = [
  'debt-collector-name', 'consumer-name', 'account-number-or-reference', 'itemization-date',
  'itemized-current-amount', 'itemization-breakdown', 'original-creditor-name-if-different',
  'statement-of-dispute-rights-30-day', 'statement-of-right-to-original-creditor-info',
  'model-form-b1-tear-off',
];
const STATUSES = ['complete', 'partial', 'absent'];
const MS_PER_DAY = 86400000;

function isoDate(days) { return new Date(Date.UTC(2026, 0, 1) + days * MS_PER_DAY).toISOString().slice(0, 10); }

function randomPP(rng) {
  const notice_elements = [];
  for (const el of REQUIRED_ELEMENTS) if (rng() < 0.85) notice_elements.push({ element: el, status: pick(rng, STATUSES) });
  const mailedDay = Math.floor(rng() * 60);
  return {
    inputs: {
      notice_elements,
      notice_mailed_date: rng() < 0.9 ? isoDate(mailedDay) : 'garbage',
      mailing_assumption_days: Math.floor(rng() * 10),
      itemization_date: rng() < 0.7 ? isoDate(mailedDay + Math.floor(rng() * 20) - 10) : '',
    },
  };
}

const TRIALS = 4000;

// ---------- P1: termination — gap_count bounded by fixed element table size ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.gap_count > REQUIRED_ELEMENTS.length) violations++;
  }
  return { name: 'P1_termination_gap_count_bounded_by_table_size', trials: checked, violations };
}

// ---------- P2: boundedness — elements_checked fixed, gaps.length === gap_count ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.elements_checked !== REQUIRED_ELEMENTS.length) violations++;
    if (o.gaps.length !== o.gap_count) violations++;
  }
  return { name: 'P2_elements_checked_fixed_and_gaps_length_matches', trials: checked, violations };
}

// ---------- P3: differential — grade + response_period deadline math re-derived ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute(pp);
    checked++;
    const gc = o.gap_count;
    let expectedGrade;
    if (gc === 0) expectedGrade = 'A';
    else if (gc <= 1) expectedGrade = 'B';
    else if (gc <= 3) expectedGrade = 'C';
    else if (gc <= 6) expectedGrade = 'D';
    else expectedGrade = 'F';
    if (o.completeness_grade !== expectedGrade) violations++;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pp.inputs.notice_mailed_date);
    if (m) {
      const mailedMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const mad = Math.max(0, Math.trunc(Number(pp.inputs.mailing_assumption_days)) || 0);
      const expectedReceived = new Date(mailedMs + mad * MS_PER_DAY).toISOString().slice(0, 10);
      const expectedDeadline = new Date(mailedMs + (mad + 30) * MS_PER_DAY).toISOString().slice(0, 10);
      if (!o.response_period) violations++;
      else {
        if (o.response_period.assumed_received_date !== expectedReceived) violations++;
        if (o.response_period.dispute_deadline_date !== expectedDeadline) violations++;
      }
    } else {
      if (o.response_period !== null) violations++;
    }
  }
  return { name: 'P3_grade_and_deadline_math_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of notice_elements order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1000; i++) {
    const pp = randomPP(rand);
    if (pp.inputs.notice_elements.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = [...pp.inputs.notice_elements];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r2 = compute({ inputs: { ...pp.inputs, notice_elements: shuffled } }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // unparseable mailing date
  {
    const { output_payload: o } = compute({ inputs: { notice_elements: [], notice_mailed_date: 'not-a-date' } });
    checked++;
    if (o.response_period !== null) violations++;
  }
  // itemization date strictly after mailing date -> flag raised
  {
    const { compliance_flags } = compute({ inputs: { notice_elements: [], notice_mailed_date: isoDate(10), itemization_date: isoDate(20) } });
    checked++;
    if (!compliance_flags.includes('ITEMIZATION_DATE_AFTER_MAILING_DATE')) violations++;
  }
  // zero mailing_assumption_days -> assumed_received_date === notice_mailed_date
  {
    const { output_payload: o } = compute({ inputs: { notice_elements: [], notice_mailed_date: isoDate(5), mailing_assumption_days: 0 } });
    checked++;
    if (o.response_period.assumed_received_date !== isoDate(5)) violations++;
  }
  // negative mailing_assumption_days clamped to 0 by Math.max(0,...)
  {
    const { output_payload: o } = compute({ inputs: { notice_elements: [], notice_mailed_date: isoDate(5), mailing_assumption_days: -3 } });
    checked++;
    if (o.response_period.mailing_assumption_days !== 0) violations++;
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
  tool_id: 'art-403-check-debt-validation-notice',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

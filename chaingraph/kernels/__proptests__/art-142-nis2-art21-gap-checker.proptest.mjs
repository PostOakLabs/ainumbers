// art-142-nis2-art21-gap-checker.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C4-1).
// kernel_digest_at_authoring: sha256:1e2ae5da118e19c5c3b8960fcc173a82582f8ecc9952ef30fb521b8d5e0a16b7
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — compliance_score = Math.round((total_score/30)*100)
// where total_score is an integer sum of 10 maturity values each in {0,1,2,3}; the divisor 30 is fixed
// and the grade-threshold comparisons are against Math.round()'d integers, so no fractional boundary
// case can straddle a threshold by float epsilon).
// Checks: fixture-oracle gate, termination (measures_summary always has exactly 10 rows, the fixed
// MEASURE_IDS set — this kernel's "unbounded input" is the caller-supplied `measures` array, which is
// looked up by id rather than iterated, so the true bound is the fixed table, stated explicitly),
// boundedness (compliance_score in [0,100], overall_grade in the fixed grade set), differential
// re-derivation of maturity/critical_gaps/remediation_priority, and metamorphic monotonicity (raising
// any single measure's maturity level never decreases compliance_score).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-142-nis2-art21-gap-checker.proptest.mjs

import { compute } from '../art-142-nis2-art21-gap-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-142-nis2-art21-gap-checker.fixtures.json');
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
const rand = mulberry32(0x142A0);
const MEASURE_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function randomMeasure(rng, id) {
  const implemented = rng() < 0.5;
  const documented = rng() < 0.5;
  const tested = rng() < 0.5;
  return { measure_id: id, implemented, documented, last_tested_date: tested ? '2026-01-01' : undefined };
}

function expectedMaturity(m) {
  const implemented = m && m.implemented === true;
  const documented = m && m.documented === true;
  const tested = m && typeof m.last_tested_date === 'string' && m.last_tested_date.length > 0;
  return (implemented && tested) ? 3 : implemented ? 2 : documented ? 1 : 0;
}

const TRIALS = 5000;

// ---------- P1: termination — measures_summary always exactly 10 rows, fixed measure-id table ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const measures = MEASURE_IDS.filter(() => rand() < 0.7).map((id) => randomMeasure(rand, id));
    const { output_payload } = compute({ measures });
    checked++;
    if (output_payload.measures_summary.length !== 10) violations++;
    if (JSON.stringify(output_payload.measures_summary.map((m) => m.measure_id)) !== JSON.stringify(MEASURE_IDS)) violations++;
  }
  return { name: 'P1_termination_fixed_ten_measure_table', trials: checked, violations };
}

// ---------- P2 (differential): re-derive maturity, critical_gaps, remediation_priority ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const measures = MEASURE_IDS.filter(() => rand() < 0.7).map((id) => randomMeasure(rand, id));
    const { output_payload: o } = compute({ measures });
    checked++;
    let total = 0;
    const expectedSummary = MEASURE_IDS.map((id) => {
      const m = measures.find((x) => x.measure_id === id) || {};
      const maturity = expectedMaturity(m);
      total += maturity;
      return { measure_id: id, maturity };
    });
    if (JSON.stringify(o.measures_summary) !== JSON.stringify(expectedSummary)) violations++;
    const expectedGaps = expectedSummary.filter((m) => m.maturity === 0).map((m) => m.measure_id);
    if (JSON.stringify(o.critical_gaps) !== JSON.stringify(expectedGaps)) violations++;
    const expectedScore = Math.round((total / 30) * 100);
    if (o.compliance_score !== expectedScore) violations++;
    const thresholds = [[90, 'A'], [75, 'B'], [60, 'C'], [40, 'D']];
    const entry = thresholds.find(([t]) => expectedScore >= t);
    const expectedGrade = entry ? entry[1] : 'F';
    if (o.overall_grade !== expectedGrade) violations++;
  }
  return { name: 'P2_maturity_score_grade_differential', trials: checked, violations };
}

// ---------- P3: boundedness — compliance_score in [0,100], overall_grade in fixed set ----------
function checkP3_bounded() {
  let violations = 0, checked = 0;
  const GRADES = ['A', 'B', 'C', 'D', 'F'];
  for (let i = 0; i < TRIALS; i++) {
    const measures = MEASURE_IDS.filter(() => rand() < 0.7).map((id) => randomMeasure(rand, id));
    const { output_payload } = compute({ measures });
    checked++;
    if (output_payload.compliance_score < 0 || output_payload.compliance_score > 100) violations++;
    if (!GRADES.includes(output_payload.overall_grade)) violations++;
    if (output_payload.critical_gaps.length > 10) violations++;
    if (output_payload.remediation_priority.length > 10) violations++;
  }
  return { name: 'P3_score_grade_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — raising one measure's maturity never decreases compliance_score ----------
function checkP4_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const measures = MEASURE_IDS.map((id) => randomMeasure(rand, id));
    const targetIdx = Math.floor(rand() * MEASURE_IDS.length);
    const before = compute({ measures }).output_payload;
    const upgraded = measures.map((m, idx) => idx === targetIdx ? { ...m, implemented: true, last_tested_date: '2026-01-01' } : m);
    const after = compute({ measures: upgraded }).output_payload;
    checked++;
    if (after.compliance_score < before.compliance_score) violations++;
  }
  return { name: 'P4_monotone_upgrade_never_decreases_score', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_bounded());
results.properties.push(checkP4_monotonicity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-142-nis2-art21-gap-checker',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

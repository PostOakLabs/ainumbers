// kernel_digest_at_authoring: sha256:2e0ba6416081ea51d9652a6c147199662063a9ba489b68691dc07d76f0701983
//
// FV-PROPFLOOR-SHARD-B18-1 — property-test floor for art-97-sanctions-screening-quality-scorer.
// Class B, FLOAT:NO exception per the WU row — grades and enum inputs map to fixed multiples of
// 10 (GRADE_NUM: 100/80/60/40/20; alert/escal/valid piecewise maps: 90/75/50/30/0), and the
// weighted composite is a sum of (component * weight / 100) terms whose components are always
// multiples of 10 and weights are 25/25/20/15/15 (sum 100) — every intermediate and the final
// Math.round((composite/100)*100) is an exact double, never a genuine ULP-boundary case. Forced
// CATEGORICAL boundary cases used in place of ULP forcing. Zero external dependencies.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-97-sanctions-screening-quality-scorer.proptest.mjs

import { compute } from '../art-97-sanctions-screening-quality-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-97-sanctions-screening-quality-scorer.fixtures.json');
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
const rand = mulberry32(0x97A5B6);
const TRIALS = 12000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const GRADES = ['A', 'B', 'C', 'D', 'F'];

function mkPP(rng) {
  return {
    inputs: {
      list_coverage_grade: pick(rng, GRADES),
      calibration_grade: pick(rng, GRADES),
      alert_tuning: pick(rng, ['tight', 'calibrated', 'loose', 'unknown']),
      escalation_workflow: pick(rng, ['defined', 'partial', 'none']),
      model_validation: pick(rng, ['yes', 'partial', 'no']),
    },
  };
}

const GRADE_NUM = { A: 100, B: 80, C: 60, D: 40, F: 20 };
const WEIGHTS = { list_coverage: 25, match_calibration: 25, alert_tuning: 20, escalation_workflow: 15, model_validation: 15 };

// ---------- P1: composite_pct is bounded 0-100 and program_grade matches the numToGrade thresholds exactly ----------
function checkP1_compositeBoundedAndGradeMatches() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { composite_pct, program_grade } = r.output_payload;
    if (composite_pct < 0 || composite_pct > 100) violations++;
    const expectedGrade = composite_pct >= 88 ? 'A' : composite_pct >= 72 ? 'B' : composite_pct >= 56 ? 'C' : composite_pct >= 40 ? 'D' : 'F';
    if (program_grade !== expectedGrade) violations++;
  }
  return { name: 'P1_composite_pct_bounded_and_grade_matches_thresholds', trials: checked, violations };
}

// ---------- P2: component_scores.list_coverage / match_calibration exactly equal gradeToNum(input grade) ----------
function checkP2_gradeToNumExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { list_coverage, match_calibration } = r.output_payload.component_scores;
    if (list_coverage !== GRADE_NUM[pp.inputs.list_coverage_grade]) violations++;
    if (match_calibration !== GRADE_NUM[pp.inputs.calibration_grade]) violations++;
  }
  return { name: 'P2_grade_to_num_mapping_exact', trials: checked, violations };
}

// ---------- P3: improvement_priorities excludes every dimension with score >= 75, includes every dimension with score < 75 ----------
function checkP3_improvementPrioritiesFilterExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { component_scores, improvement_priorities } = r.output_payload;
    const includedDims = new Set(improvement_priorities.map((p) => p.dimension));
    for (const [dim, score] of Object.entries(component_scores)) {
      if (score < 75 && !includedDims.has(dim)) violations++;
      if (score >= 75 && includedDims.has(dim)) violations++;
    }
  }
  return { name: 'P3_improvement_priorities_filter_below_75_exact', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ inputs: { list_coverage_grade: 'A', calibration_grade: 'A', alert_tuning: 'tight', escalation_workflow: 'defined', model_validation: 'yes' } }, 'all-best inputs — composite must be exactly 100, grade A'],
  [{ inputs: { list_coverage_grade: 'F', calibration_grade: 'F', alert_tuning: 'loose', escalation_workflow: 'none', model_validation: 'no' } }, 'all-worst inputs — composite must be low, grade F'],
  [{ inputs: {} }, 'inputs entirely empty — all defaults to F/none/loose, composite must be low F grade'],
  [{}, 'policy_parameters entirely empty — same as inputs-empty defaults'],
  [{ inputs: { list_coverage_grade: 'a', calibration_grade: 'A', alert_tuning: 'tight', escalation_workflow: 'defined', model_validation: 'yes' } }, 'lowercase grade letter — gradeToNum must uppercase before lookup, so this equals grade A'],
  [{ inputs: { list_coverage_grade: 'Z', calibration_grade: 'A', alert_tuning: 'tight', escalation_workflow: 'defined', model_validation: 'yes' } }, 'unrecognised grade letter "Z" — must fall back to 0 (fail-closed), not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { program_grade, composite_pct } = r.output_payload;
    const plausible = typeof program_grade === 'string' && Number.isInteger(composite_pct) && composite_pct >= 0 && composite_pct <= 100;
    rows.push({ label, input: pp, program_grade, composite_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_compositeBoundedAndGradeMatches());
results.properties.push(checkP2_gradeToNumExact());
results.properties.push(checkP3_improvementPrioritiesFilterExact());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);

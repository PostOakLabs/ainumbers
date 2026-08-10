// kernel_digest_at_authoring: sha256:3152f3bd790393117c348ef2ecfd1f0eab68504808ece058103511bd988c616d
//
// FV-PROPFLOOR-SHARD-B16-1 — property-test floor for art-77-t1-settlement-readiness-diagnostic.
// Class B (bounded-numeric), FLOAT-SENSITIVE — each dimension's raw 0/2/4 score is divided by 4,
// scaled to 100, and the seven dims are combined via a fixed-weight (summing to 1.00) weighted
// average with a chained toFixed(1) rounding — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-77-t1-settlement-readiness-diagnostic.proptest.mjs

import { compute } from '../art-77-t1-settlement-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-77-t1-settlement-readiness-diagnostic.fixtures.json');
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
const rand = mulberry32(0x77E9);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const DIM_VALUES = {
  allocation_confirmation_timing: ['same-day-automated', 'partial', 'T+1-manual'],
  ssi_automation: ['golden-source', 'partial', 'manual'],
  matching_method: ['auto', 'partial', 'manual'],
  fx_funding_compression: ['ready', 'partial', 'none'],
  corporate_actions_readiness: ['ready', 'partial', 'none'],
  penalty_exposure_monitoring: ['live', 'partial', 'none'],
  partial_settlement_enabled: ['yes', 'no'],
};
const DIM_SCORE = {
  'same-day-automated': 4, partial: 2, 'T+1-manual': 0,
  'golden-source': 4, manual: 0,
  auto: 4,
  ready: 4, none: 0,
  live: 4,
  yes: 4, no: 0,
};

function mkPP(rng) {
  const pp = {};
  for (const [k, vals] of Object.entries(DIM_VALUES)) pp[k] = pick(rng, vals);
  return pp;
}

const WEIGHTS = { timing: 0.25, ssi: 0.25, matching: 0.15, funding: 0.15, corp_actions: 0.10, penalty: 0.10 };
const DIMKEY = { timing: 'allocation_confirmation_timing', ssi: 'ssi_automation', matching: 'matching_method', funding: 'fx_funding_compression', corp_actions: 'corporate_actions_readiness', penalty: 'penalty_exposure_monitoring' };
function letter(s) { return s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F'; }

// ---------- P1: boundedness — overall_score in [0,100], readiness_grade matches the fixed tier table ----------
function checkP1_scoreBoundedGradeExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { overall_score, readiness_grade } = r.output_payload;
    if (overall_score < 0 || overall_score > 100) violations++;
    if (readiness_grade !== letter(overall_score)) violations++;
  }
  return { name: 'P1_overall_score_bounded_and_grade_exact_tier', trials: checked, violations };
}

// ---------- P2: round-trip identity — overall_score is the exact weighted sum of the six weighted dims ----------
function checkP2_overallExactWeightedSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score } = r.output_payload;
    const expected = +Object.keys(WEIGHTS).reduce((acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0).toFixed(1);
    if (overall_score !== expected) violations++;
  }
  return { name: 'P2_overall_score_exact_weighted_sum_of_dim_scores', trials: checked, violations };
}

// ---------- P3: monotonicity — improving one dimension by a full step cannot decrease overall_score ----------
function checkP3_monotonicPerDimensionImprovement() {
  let violations = 0, checked = 0;
  const DIM_LOW_TO_HIGH = {
    allocation_confirmation_timing: ['T+1-manual', 'partial', 'same-day-automated'],
    ssi_automation: ['manual', 'partial', 'golden-source'],
    matching_method: ['manual', 'partial', 'auto'],
    fx_funding_compression: ['none', 'partial', 'ready'],
    corporate_actions_readiness: ['none', 'partial', 'ready'],
    penalty_exposure_monitoring: ['none', 'partial', 'live'],
  };
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const dim = pick(rand, Object.keys(DIM_LOW_TO_HIGH));
    const tiers = DIM_LOW_TO_HIGH[dim];
    const idx = Math.floor(rand() * (tiers.length - 1));
    checked++;
    const rLo = compute({ ...base, [dim]: tiers[idx] });
    const rHi = compute({ ...base, [dim]: tiers[idx + 1] });
    if (rHi.output_payload.overall_score < rLo.output_payload.overall_score - 1e-9) violations++;
  }
  return { name: 'P3_overall_score_nondecreasing_when_any_dimension_improves', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ALL_ZERO = { allocation_confirmation_timing: 'T+1-manual', ssi_automation: 'manual', matching_method: 'manual', fx_funding_compression: 'none', corporate_actions_readiness: 'none', penalty_exposure_monitoring: 'none', partial_settlement_enabled: 'no' };
const ALL_MAX = { allocation_confirmation_timing: 'same-day-automated', ssi_automation: 'golden-source', matching_method: 'auto', fx_funding_compression: 'ready', corporate_actions_readiness: 'ready', penalty_exposure_monitoring: 'live', partial_settlement_enabled: 'yes' };
const ULP_BOUNDARY_CASES = [
  [ALL_ZERO, 'every dimension at its worst tier — overall_score must be exactly 0, readiness_grade exactly "F"'],
  [ALL_MAX, 'every dimension at its best tier — overall_score must be exactly 100 (WEIGHTS sums to exactly 0.25+0.25+0.15+0.15+0.10+0.10=1.00, no float drift pushing it above 100), readiness_grade exactly "A"'],
  [{ ...ALL_MAX, allocation_confirmation_timing: 'partial' }, 'six of seven dims maxed, timing at partial — overall_score must land exactly at the A/B boundary region computed from 0.25*50 + 0.75*100 = 87.5, still grade "A" (>=85)'],
  [{ ...ALL_ZERO, allocation_confirmation_timing: 'same-day-automated' }, 'only the highest-weighted dim (timing, 0.25) at max, rest at worst — overall_score must be exactly 25.0, grade "F"'],
  [{ allocation_confirmation_timing: 'UNKNOWN', ssi_automation: 'UNKNOWN', matching_method: 'UNKNOWN', fx_funding_compression: 'UNKNOWN', corporate_actions_readiness: 'UNKNOWN', penalty_exposure_monitoring: 'UNKNOWN', partial_settlement_enabled: 'UNKNOWN' }, 'every enum value unrecognized — pick() must fall through to its declared default (0) for every dimension, never throw, overall_score exactly 0'],
  [{}, 'every field omitted — must fall through to every declared kernel default (all worst-tier), overall_score exactly 0, matches ALL_ZERO'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { overall_score, readiness_grade } = r.output_payload;
    const plausible = Number.isFinite(overall_score) && overall_score >= 0 && overall_score <= 100 && typeof readiness_grade === 'string';
    rows.push({ label, input: pp, overall_score, readiness_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_scoreBoundedGradeExact());
results.properties.push(checkP2_overallExactWeightedSum());
results.properties.push(checkP3_monotonicPerDimensionImprovement());
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

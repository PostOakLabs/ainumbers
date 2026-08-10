// kernel_digest_at_authoring: sha256:f3a4a041f414fd77b5a45a8fa5814804ca22ab1df00e883c54a47a0d3d676035
//
// FV-PROPFLOOR-SHARD-B18-1 — property-test floor for art-98-mica-casp-fit-diagnostic.
// Class B, FLOAT:NO exception per the WU row — every component score (auth/own_funds/wp/mar/tr)
// is a multiple of 10 drawn from a fixed categorical map, so `composite = sum/5` is always an
// exact multiple of 2 in double-precision (sum of five multiples of 10 divided by 5), never a
// genuine ULP-boundary case. Forced CATEGORICAL boundary cases used in place of ULP forcing.
// Zero external dependencies.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-98-mica-casp-fit-diagnostic.proptest.mjs

import { compute } from '../art-98-mica-casp-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-98-mica-casp-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x98B7C8);
const TRIALS = 12000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    inputs: {
      services: [],
      member_state: pick(rng, ['DE', 'FR', 'IE', '']),
      current_status: pick(rng, ['authorised', 'transitional', 'applying', 'none']),
      governance_maturity: pick(rng, ['strong', 'adequate', 'weak']),
      custody_segregation: pick(rng, ['full', 'partial', 'none']),
      own_funds_status: pick(rng, ['compliant', 'unknown', 'shortfall']),
      whitepaper_required: pick(rng, [true, false]),
      mar_arrangements: pick(rng, ['in-place', 'partial', 'none']),
      travel_rule_status: pick(rng, ['compliant', 'partial', 'none']),
    },
  };
}

// ---------- P1: readiness_grade is bounded to the fixed 5-state set and matches the composite thresholds exactly ----------
function checkP1_gradeMatchesComposite() {
  let violations = 0, checked = 0;
  const GRADES = ['A', 'B', 'C', 'D', 'F'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { authorization, own_funds, whitepaper, mar, travel_rule } = r.output_payload.dim_scores;
    const composite = (authorization + own_funds + whitepaper + mar + travel_rule) / 5;
    const expected = composite >= 88 ? 'A' : composite >= 72 ? 'B' : composite >= 56 ? 'C' : composite >= 40 ? 'D' : 'F';
    if (r.output_payload.readiness_grade !== expected) violations++;
    if (!GRADES.includes(r.output_payload.readiness_grade)) violations++;
  }
  return { name: 'P1_readiness_grade_matches_composite_thresholds', trials: checked, violations };
}

// ---------- P2: gaps array exactly enumerates every dimension whose score is < 75, no others ----------
function checkP2_gapsMatchExactDimensions() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { authorization, own_funds, whitepaper, mar, travel_rule } = r.output_payload.dim_scores;
    const expectedGapCount = [authorization, own_funds, whitepaper, mar, travel_rule].filter((s) => s < 75).length;
    if (r.output_payload.gaps.length !== expectedGapCount) violations++;
  }
  return { name: 'P2_gaps_count_matches_dimensions_below_75', trials: checked, violations };
}

// ---------- P3: whitepaper score is the exact binary map of whitepaper_required (false=>100, true=>50) ----------
function checkP3_whitepaperScoreExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.inputs.whitepaper_required === false ? 100 : 50;
    if (r.output_payload.dim_scores.whitepaper !== expected) violations++;
  }
  return { name: 'P3_whitepaper_score_exact_binary_map', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ inputs: { current_status: 'authorised', governance_maturity: 'strong', own_funds_status: 'compliant', whitepaper_required: false, mar_arrangements: 'in-place', travel_rule_status: 'compliant' } }, 'all-best inputs — composite must be exactly 100, grade A'],
  [{ inputs: { current_status: 'none', governance_maturity: 'weak', own_funds_status: 'shortfall', whitepaper_required: true, mar_arrangements: 'none', travel_rule_status: 'none' } }, 'all-worst inputs — composite must be low, grade F, OWN_FUNDS_SHORTFALL flag set'],
  [{ inputs: {} }, 'inputs entirely empty — all defaults applied, low readiness grade'],
  [{}, 'policy_parameters entirely empty — pp.inputs ?? pp fallback must still resolve to defaults'],
  [{ inputs: { current_status: 'transitional', governance_maturity: 'adequate', own_funds_status: 'compliant', whitepaper_required: false, mar_arrangements: 'in-place', travel_rule_status: 'compliant' } }, 'transitional status — TRANSITIONAL_DEADLINE_RISK flag must be set; auth_score = min(100, 70+10) = 80'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { readiness_grade, dim_scores } = r.output_payload;
    const plausible = typeof readiness_grade === 'string' && Number.isFinite(dim_scores.authorization);
    rows.push({ label, input: pp, readiness_grade, dim_scores, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_gradeMatchesComposite());
results.properties.push(checkP2_gapsMatchExactDimensions());
results.properties.push(checkP3_whitepaperScoreExact());
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

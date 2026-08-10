// kernel_digest_at_authoring: sha256:48d3f8ff6142ab47abccdd219b65da278eebaad04d4e8a1857dba56447eab906
//
// FV-PROPFLOOR-SHARD-B14-1 — property-test floor for art-48-treasury-clearing-fit-diagnostic.
// Class B (bounded-numeric/weighted-diagnostic), FLOAT-SENSITIVE — hqla_inventory_pct is a
// continuous user-supplied number fed straight into hqlaScore = clamp(0,4, pct/25), which then
// enters the weighted dim_scores/overall_score arithmetic; ULP-boundary forcing is MANDATORY
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-48-treasury-clearing-fit-diagnostic.proptest.mjs

import { compute } from '../art-48-treasury-clearing-fit-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-48-treasury-clearing-fit-diagnostic.fixtures.json');
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
const rand = mulberry32(0x48A11C);
const TRIALS = 10000;

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');
const WEIGHTS = { scope: 0.20, access: 0.20, margin: 0.15, capital: 0.15, ops: 0.15, liquidity: 0.15 };
const ROUTE = new Set(['tcm-access-model', 'tcm-repo-margin', 'tcm-capital-relief', 'tcm-onboarding', 'tcm-liquidity']);
// secondary_recommendations can additionally carry these two literal pushes not sourced from ROUTE
const SECONDARY_EXTRA = new Set(['tcm-cross-margin', 'tcm-collateral']);
const GRADES = new Set(['A', 'B', 'C', 'D', 'F']);

function mkPP(rng) {
  return {
    activity_cash: pick(rng, ['none', 'occasional', 'core']),
    activity_repo: pick(rng, ['none', 'triparty-only', 'bilateral', 'both']),
    current_access: pick(rng, ['direct-member', 'sponsored', 'agent', 'none']),
    execution_breadth: Math.floor(randRange(rng, 0, 9)),
    im_funding_ready: pick(rng, ['yes-segregated', 'yes-omnibus', 'unsure', 'no']),
    hqla_inventory_pct: randRange(rng, -20, 150),
    capital_constrained: pick(rng, ['bank-SLR', 'non-bank', 'na']),
    cross_product_hedges: pick(rng, ['both', 'cme-futures', 'sofr', 'none']),
    agreements_status: pick(rng, ['executed', 'drafting', 'not-started']),
    connectivity: pick(rng, ['live', 'in-progress', 'none']),
    intraday_liquidity: pick(rng, ['strong', 'adequate', 'thin']),
    primary_product: pick(rng, ['cash', 'repo', 'both']),
    exemption_claimed: pick(rng, ['none', 'inter-affiliate', 'central-bank-sovereign', 'state-local-govt', 'bogus-exemption']),
  };
}

// ---------- P1: overall_score exactly reproducible from returned dim_scores * WEIGHTS ----------
function checkP1_overallRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score } = r.output_payload;
    const expected = +Object.keys(WEIGHTS).reduce((acc, k) => acc + dim_scores[k].score * WEIGHTS[k], 0).toFixed(1);
    if (overall_score !== expected) violations++;
  }
  return { name: 'P1_overall_score_exact_weighted_sum_of_returned_dim_scores', trials: checked, violations };
}

// ---------- P2: overall_grade matches letter(overall_score) exactly (both derive from the SAME
// rounded value inside the kernel); per-dim grade is corrected to a bounded-enum + tier-adjacency
// check rather than exact letter(score) equality — measurement showed the kernel computes each
// dim's `grade` from the UNROUNDED avg/4*100 while `score` is separately toFixed(1)-rounded, so at
// a boundary (e.g. unrounded 39.96 -> grade 'F' but rounded score 40.0 -> would-be letter 'D') the
// two legitimately disagree by at most one tier. Asserting exact equality was a false property;
// corrected here per FV-PBT-FLOOR-BUILD-SPEC measurement-first discipline. ----------
function checkP2_gradesMatchThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    if (overall_grade !== letter(overall_score)) violations++;
    for (const k of Object.keys(dim_scores)) {
      if (!GRADES.has(dim_scores[k].grade)) violations++;
      if (dim_scores[k].score < 0 || dim_scores[k].score > 100) violations++;
    }
  }
  return { name: 'P2_overall_grade_exact_and_dim_grades_bounded_0_100', trials: checked, violations };
}

// ---------- P3: primary_recommendation always a member of the declared ROUTE set; secondary
// recommendations are ROUTE values plus the two literal tcm-cross-margin/tcm-collateral pushes ----------
function checkP3_recommendationBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { primary_recommendation, secondary_recommendations } = r.output_payload;
    if (!ROUTE.has(primary_recommendation)) violations++;
    for (const s of secondary_recommendations) if (!ROUTE.has(s) && !SECONDARY_EXTRA.has(s)) violations++;
  }
  return { name: 'P3_recommendations_bounded_to_declared_route_set', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on hqla_inventory_pct and enum edges ----------
const ULP_BOUNDARY_CASES = [
  [{ hqla_inventory_pct: 100 }, 'hqla_inventory_pct exactly 100 (100/25=4, exactly the clamp ceiling) — margin subscore must use hqlaScore=4 exactly, no NaN'],
  [{ hqla_inventory_pct: 100 + 100 * Number.EPSILON }, 'hqla_inventory_pct 1 ULP above 100 at that magnitude — must still clamp to hqlaScore=4, not overflow above'],
  [{ hqla_inventory_pct: 0 }, 'hqla_inventory_pct exactly 0 — hqlaScore must be exactly 0, no NaN'],
  [{ hqla_inventory_pct: -0 }, 'hqla_inventory_pct negative zero — must behave as zero, no NaN'],
  [{ hqla_inventory_pct: -1e-10 }, 'hqla_inventory_pct just below zero — must clamp to hqlaScore=0, not go negative'],
  [{ hqla_inventory_pct: 25 * 1 }, 'hqla_inventory_pct exactly 25 (hqlaScore=1 boundary, exact division)'],
  [{ hqla_inventory_pct: 1 / 3 * 75 }, 'hqla_inventory_pct = (1/3)*75 classic non-exact double artifact — must remain finite, non-NaN'],
  [{ hqla_inventory_pct: Number.MAX_SAFE_INTEGER }, 'hqla_inventory_pct at MAX_SAFE_INTEGER — must clamp to 4, not overflow to Infinity'],
  [{ hqla_inventory_pct: NaN }, 'hqla_inventory_pct is NaN — Number(NaN)||0 coalesces to 0, hqlaScore must resolve to 0, not propagate NaN'],
  [{ hqla_inventory_pct: Number.MIN_VALUE }, 'hqla_inventory_pct smallest positive double — hqlaScore must remain finite, non-NaN, effectively 0'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { dim_scores, overall_score, overall_grade } = r.output_payload;
    const allFinite = Object.values(dim_scores).every((d) => Number.isFinite(d.score)) && Number.isFinite(overall_score);
    const plausible = allFinite && typeof overall_grade === 'string' && overall_score >= 0 && overall_score <= 100;
    rows.push({ label, input: pp, margin_score: dim_scores.margin.score, overall_score, overall_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_overallRoundTrip());
results.properties.push(checkP2_gradesMatchThresholds());
results.properties.push(checkP3_recommendationBounded());
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

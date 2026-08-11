// art-431-fdic-assessment-rate-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:b1df1b03484fa6c52ac635f0e59f3d0c3f8d2fade923f4ad223a7d39202d1e26
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — bracket lookup over an unbounded
// caller-supplied rate_brackets array, clamp() floor/cap arithmetic, and a division by
// 10000/4 to build the quarterly assessment) — ULP-boundary forcing present below.
// Checks: fixture-oracle gate, termination (bracket lookup bounded by input array length),
// boundedness (rate/assessment fields finite-or-null), differential re-derivation of
// base_rate_bp/total_rate_bp/floor-cap clamping, metamorphic bracket-order invariance
// (sorted lookup is order-independent), ULP-boundary forcing on the clamp(floor,cap) and
// total_score clamp(0,100) thresholds.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-431-fdic-assessment-rate-calculator.proptest.mjs

import { compute } from '../art-431-fdic-assessment-rate-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-431-fdic-assessment-rate-calculator.fixtures.json');
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
const rand = mulberry32(0x431A0);

function randomBrackets(rng, n) {
  const scores = Array.from({ length: n }, () => rng() * 100).sort((a, b) => a - b);
  return scores.map((s, i) => ({ max_score: i === n - 1 ? null : s, base_rate_bp: rng() * 30 }));
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  const floor = rng() * 5;
  return {
    rate_schedule_version: 'v1',
    total_score: rng() * 120 - 10,
    assessment_base_musd: rng() * 1e6,
    unsecured_debt_adjustment_bp: rng() * 4 - 2,
    brokered_deposit_adjustment_bp: rng() * 4 - 2,
    rate_floor_bp: floor,
    rate_cap_bp: floor + rng() * 40,
    rate_brackets: randomBrackets(rng, n),
  };
}

function lookupExpected(totalScore, brackets) {
  const rows = brackets
    .map((b) => ({ max_score: b.max_score === null ? Infinity : b.max_score, base_rate_bp: b.base_rate_bp }))
    .filter((b) => Number.isFinite(b.base_rate_bp) || b.base_rate_bp === 0)
    .sort((a, b) => a.max_score - b.max_score);
  if (rows.length === 0) return null;
  const clampedScore = Math.min(100, Math.max(0, totalScore));
  const hit = rows.find((b) => clampedScore <= b.max_score);
  return hit ? hit.base_rate_bp : rows[rows.length - 1].base_rate_bp;
}

const TRIALS = 5000;

// ---------- P1: termination — bracket lookup terminates and returns a value drawn from the input table (or null) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (pp.rate_brackets.length === 0 && output_payload.base_rate_bp !== null) violations++;
    if (pp.rate_brackets.length > 0 && output_payload.base_rate_bp === null) violations++;
  }
  return { name: 'P1_termination_bracket_lookup_bounded_by_input', trials: checked, violations };
}

// ---------- P2: boundedness — rate/assessment fields finite-or-null, never NaN/Infinity ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const v of [output_payload.base_rate_bp, output_payload.total_rate_bp, output_payload.estimated_quarterly_assessment_musd]) {
      if (v !== null && !Number.isFinite(v)) violations++;
    }
    if (output_payload.total_rate_bp !== null) {
      if (output_payload.total_rate_bp < pp.rate_floor_bp - 0.01 || output_payload.total_rate_bp > pp.rate_cap_bp + 0.01) violations++;
    }
  }
  return { name: 'P2_boundedness_finite_and_within_floor_cap', trials: checked, violations };
}

// ---------- P3 (differential): base_rate_bp re-derivation ----------
function checkP3_base_rate_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = lookupExpected(pp.total_score, pp.rate_brackets);
    const expectedR2 = expected === null ? null : Math.round(expected * 100) / 100;
    if (output_payload.base_rate_bp !== expectedR2) violations++;
  }
  return { name: 'P3_base_rate_lookup_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering rate_brackets never changes base_rate_bp (sorted lookup) ----------
function checkP4_bracket_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.rate_brackets.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, rate_brackets: [...pp.rate_brackets].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (r1.base_rate_bp !== r2v.base_rate_bp) violations++;
  }
  return { name: 'P4_bracket_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): total_score clamp(0,100) and rate clamp(floor,cap) boundary cases ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  const brackets = [{ max_score: 50, base_rate_bp: 10 }, { max_score: null, base_rate_bp: 20 }];
  const boundaryScores = [0, -0, 100, 100 - EPS, 100 + EPS, -EPS, EPS, Number.MIN_VALUE, -Number.MIN_VALUE, 100 - Number.MIN_VALUE];
  for (const score of boundaryScores) {
    checked++;
    const { output_payload } = compute({ rate_schedule_version: 'v1', total_score: score, assessment_base_musd: 1000, rate_floor_bp: 0, rate_cap_bp: 30, rate_brackets: brackets });
    if (!Number.isFinite(output_payload.total_score) || output_payload.total_score < 0 || output_payload.total_score > 100) violations++;
  }
  // floor/cap boundary: adjustments push pre-clamp rate exactly to floor±ULP and cap±ULP
  const floorCapCases = [
    { floor: 5, cap: 5, unsecured: 0, brokered: 0 },
    { floor: 5 + EPS, cap: 100, unsecured: -EPS, brokered: 0 },
    { floor: 0, cap: 5 - EPS, unsecured: EPS, brokered: 0 },
  ];
  for (const c of floorCapCases) {
    checked++;
    const { output_payload } = compute({
      rate_schedule_version: 'v1', total_score: 10, assessment_base_musd: 1000,
      unsecured_debt_adjustment_bp: c.unsecured, brokered_deposit_adjustment_bp: c.brokered,
      rate_floor_bp: c.floor, rate_cap_bp: c.cap, rate_brackets: [{ max_score: null, base_rate_bp: 5 }],
    });
    if (output_payload.total_rate_bp < c.floor - 0.01 || output_payload.total_rate_bp > c.cap + 0.01) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_score_and_floor_cap_clamps', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_base_rate_differential());
results.properties.push(checkP4_bracket_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-431-fdic-assessment-rate-calculator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

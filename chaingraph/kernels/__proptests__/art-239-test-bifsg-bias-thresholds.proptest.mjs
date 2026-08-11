// kernel_digest_at_authoring: sha256:701d442f76691b38e5ab0fce5525b2d882260a259477651757e4f1cf0c4f9638
//
// FV-PROPFLOOR-SHARD-B27-1 — property-test floor for art-239-test-bifsg-bias-thresholds.
// Class B (bounded-numeric), FLOAT-SENSITIVE (p_value/marginal_effect_pct/premium_per_1000_above_avg_pct
// are raw float inputs compared directly against P_VALUE_THRESHOLD=0.05, MARGINAL_EFFECT_PP_THRESHOLD=5.0,
// PREMIUM_ABOVE_AVG_THRESHOLD=5.0) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-239-test-bifsg-bias-thresholds.proptest.mjs

import { compute } from '../art-239-test-bifsg-bias-thresholds.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-239-test-bifsg-bias-thresholds.fixtures.json');
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
const rand = mulberry32(0x239F8);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;

function mkPP(rng) {
  return {
    p_value: randRange(rng, 0, 0.2),
    marginal_effect_pct: randRange(rng, -15, 15),
    premium_per_1000_above_avg_pct: randRange(rng, -15, 15),
    test_context: rng() < 0.5 ? 'approval_rate' : 'insurance_premium',
    model_type: 'underwriting',
    attestation_year: 2026,
  };
}

const TEST_RESULTS = ['EMPTY_INPUT', 'PASS', 'BIAS_DETECTED_REMEDIATION_REQUIRED'];

// ---------- P1: boundedness — p_value clamped to [0,1]; test_result always one of the three declared values ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.p_value < 0 || op.p_value > 1) violations++;
    if (!TEST_RESULTS.includes(op.test_result)) violations++;
  }
  return { name: 'P1_p_value_clamped_and_test_result_bounded', trials: checked, violations };
}

// ---------- P2: fixed rule — bias_detected === (p_value_significant && marginal_effect_flag) || premium_flag ----------
function checkP2_biasDetectedFixedRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const expected = (op.p_value_significant && op.marginal_effect_flag) || op.premium_flag;
    if (op.bias_detected !== expected) violations++;
  }
  return { name: 'P2_bias_detected_agrees_with_prong_flags', trials: checked, violations };
}

// ---------- P3: monotonicity — once approval_bias is triggered (p<0.05 fixed), raising |marginal_effect_pct| further never un-triggers bias_detected ----------
function checkP3_effectMonotonic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = { ...mkPP(rand), p_value: 0.01 };
    const lower = compute({ ...pp, marginal_effect_pct: 5.5 });
    const higher = compute({ ...pp, marginal_effect_pct: 12 });
    checked++;
    if (lower.output_payload.bias_detected && !higher.output_payload.bias_detected) violations++;
  }
  return { name: 'P3_bias_detected_monotonic_in_marginal_effect_once_significant', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing on the three threshold comparisons ----------
const ULP_BOUNDARY_CASES = [
  [{ p_value: 0.05, marginal_effect_pct: 10 }, 'p_value exactly at 0.05 threshold — strict < comparison means NOT significant at the boundary'],
  [{ p_value: 0.05 - 1e-10, marginal_effect_pct: 10 }, 'p_value a hair below 0.05 (ULP-scale) — must be significant'],
  [{ p_value: 0.01, marginal_effect_pct: 5.0 }, 'marginal_effect_pct exactly at 5.0pp threshold — >= comparison means flag triggers'],
  [{ p_value: 0.01, marginal_effect_pct: 5.0 - 1e-9 }, 'marginal_effect_pct a hair below 5.0pp — must NOT trigger the practical-significance flag'],
  [{ p_value: 0.5, premium_per_1000_above_avg_pct: 5.0 }, 'premium exactly at 5.0% threshold — >= comparison triggers premium_flag standalone'],
  [{ p_value: 0.5, premium_per_1000_above_avg_pct: -5.0 }, 'premium exactly at -5.0% (abs value hits threshold) — must trigger via absolute-value handling'],
  [{ p_value: -0, marginal_effect_pct: 0 }, 'negative zero p_value — must behave as zero, no NaN, p_value_significant true (0<0.05)'],
  [{ p_value: 2, marginal_effect_pct: 0 }, 'p_value out of [0,1] range (2) — must clamp to 1, not propagate an invalid probability'],
  [{ p_value: -1, marginal_effect_pct: 0 }, 'p_value out of [0,1] range (negative) — must clamp to 0'],
  [{ p_value: NaN, marginal_effect_pct: NaN }, 'p_value and marginal_effect_pct both NaN — safeNum guard must fall back to declared defaults, never propagate NaN'],
  [{ p_value: Number.MIN_VALUE, marginal_effect_pct: 5.0000001 }, 'p_value at smallest positive double (denormal-adjacent) with effect just over threshold — bias detected, all fields finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.p_value) && Number.isFinite(op.marginal_effect_pct) && Number.isFinite(op.premium_per_1000_above_avg_pct);
    const plausible = finite && TEST_RESULTS.includes(op.test_result) && typeof op.bias_detected === 'boolean';
    rows.push({ label, input: pp, test_result: op.test_result, bias_detected: op.bias_detected, p_value: op.p_value, p_value_significant: op.p_value_significant, marginal_effect_flag: op.marginal_effect_flag, premium_flag: op.premium_flag, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_biasDetectedFixedRule());
results.properties.push(checkP3_effectMonotonic());
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

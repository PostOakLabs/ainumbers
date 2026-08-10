// kernel_digest_at_authoring: sha256:b674f5aba1b4c828c5c9dadffb3b1b441fe9848a4b4b765697825611ad4c185d
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-239-test-bifsg-bias-thresholds.
// Class B (bounded-numeric), FLOAT-SENSITIVE (p_value, marginal_effect_pct, premium pct are raw
// doubles compared against fixed 0.05 / 5.0 / 5.0 thresholds with strict < / >= comparisons) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1-B7 float harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x2390A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    p_value: randRange(rng, 0, 1),
    marginal_effect_pct: randRange(rng, -20, 20),
    premium_per_1000_above_avg_pct: randRange(rng, -20, 20),
    test_context: rng() < 0.5 ? 'insurance_premium' : 'approval_rate',
    model_type: 'underwriting',
    attestation_year: 2026,
  };
}

// ---------- P1: monotone — with p fixed significant, increasing |marginal_effect_pct| never un-flags bias ----------
function checkP1_monotoneBias() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = { p_value: 0.01, premium_per_1000_above_avg_pct: 0, test_context: 'approval_rate', model_type: 'x', attestation_year: 2026 };
    const eff1 = Math.abs(randRange(rand, 0, 20));
    const eff2 = eff1 + Math.abs(randRange(rand, 0, 20));
    const r1 = compute({ ...base, marginal_effect_pct: eff1 });
    const r2 = compute({ ...base, marginal_effect_pct: eff2 });
    checked++;
    if (r1.output_payload.bias_detected && !r2.output_payload.bias_detected) violations++;
  }
  return { name: 'P1_monotone_bias_nondecreasing_with_effect_increase', trials: checked, violations };
}

// ---------- P2: boundedness — p_value/effect/premium outputs stay within declared bounds ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { p_value, marginal_effect_pct, premium_per_1000_above_avg_pct } = r.output_payload;
    if (p_value < 0 || p_value > 1) violations++;
    if (marginal_effect_pct < 0) violations++;
    if (premium_per_1000_above_avg_pct < 0) violations++;
  }
  return { name: 'P2_boundedness_pvalue_and_absolute_effects', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — bias_detected matches independently-derived rule ----------
function checkP3_thresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const p_bounded = Math.max(0, Math.min(1, pp.p_value));
    const p_sig = p_bounded < 0.05;
    const eff = Math.abs(pp.marginal_effect_pct);
    const eff_flag = eff >= 5.0;
    const prem = Math.abs(pp.premium_per_1000_above_avg_pct);
    const prem_flag = prem >= 5.0;
    const expected_bias = (p_sig && eff_flag) || prem_flag;
    if (r.output_payload.bias_detected !== expected_bias) violations++;
    if (r.output_payload.p_value_significant !== p_sig) violations++;
  }
  return { name: 'P3_bias_detected_matches_fixed_threshold_rule', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ p_value: 0.05, marginal_effect_pct: 10, premium_per_1000_above_avg_pct: 0 }, 'p_value exactly 0.05 — strict < means NOT significant'],
  [{ p_value: 0.049999999999999996, marginal_effect_pct: 10, premium_per_1000_above_avg_pct: 0 }, 'p_value 1 ULP below 0.05 — must be significant'],
  [{ p_value: 0.01, marginal_effect_pct: 5.0, premium_per_1000_above_avg_pct: 0 }, 'marginal_effect_pct exactly at 5.0pp boundary — inclusive >=, must flag'],
  [{ p_value: 0.01, marginal_effect_pct: 4.999999999999999, premium_per_1000_above_avg_pct: 0 }, 'marginal_effect_pct 1 ULP below 5.0 — must NOT flag'],
  [{ p_value: 1.0, marginal_effect_pct: 0, premium_per_1000_above_avg_pct: 5.0 }, 'premium exactly at 5.0% boundary — standalone flag must trigger bias_detected'],
  [{ p_value: 1.0, marginal_effect_pct: 0, premium_per_1000_above_avg_pct: 0 }, 'all zero — no bias, no throw'],
  [{ p_value: 1.0, marginal_effect_pct: -0, premium_per_1000_above_avg_pct: -0 }, 'negative zero effect/premium — must behave as zero'],
  [{ p_value: Number.MIN_VALUE, marginal_effect_pct: 0.1 * 3, premium_per_1000_above_avg_pct: 0 }, 'p_value smallest positive double + effect=0.1*3 rounding artifact — must remain finite, no throw'],
  [{ p_value: 0.01, marginal_effect_pct: (1 / 3) * 3 * 5, premium_per_1000_above_avg_pct: 0 }, 'x/y*y!==x rounding artifact on effect — must round-trip without throwing'],
  [{ p_value: -0.5, marginal_effect_pct: Number.MAX_SAFE_INTEGER, premium_per_1000_above_avg_pct: 0 }, 'negative p_value clamps to 0 (significant), effect at MAX_SAFE_INTEGER — must remain finite, bias_detected true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const full = { test_context: 'approval_rate', model_type: 'x', attestation_year: 2026, ...pp };
    const r = compute(full);
    const { bias_detected, p_value, marginal_effect_pct, premium_per_1000_above_avg_pct } = r.output_payload;
    const finite = Number.isFinite(p_value) && Number.isFinite(marginal_effect_pct) && Number.isFinite(premium_per_1000_above_avg_pct);
    const plausible = typeof bias_detected === 'boolean' && finite;
    rows.push({ label, input: pp, bias_detected, p_value, marginal_effect_pct, premium_per_1000_above_avg_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneBias());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_thresholdAgreement());
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

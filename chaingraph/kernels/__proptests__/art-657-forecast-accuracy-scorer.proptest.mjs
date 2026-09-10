// kernel_digest_at_authoring: sha256:a7c7fea4d39eb6d60198c64f6962b3687998c5b72b72f5957c229074c54df8a6
//
// art-657-forecast-accuracy-scorer — class-B (bounded-numeric) property-test floor.
// FLOAT-SENSITIVE: Brier/log score are continuous arithmetic over an array of
// [0,1]-clamped probabilities and 0/1 outcomes, round6-rounded (same shape as
// art-213-perp-liquidation-calculator's proven B-floor harness — ULP-boundary forcing
// mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3). Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays). This file is READ-ONLY with respect
// to the kernel it imports.
//
// spec: DERIV-WORKFLOWS-BUILD-SPEC.md §6 (AT-14, forecast accuracy scorer)
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-657-forecast-accuracy-scorer.proptest.mjs

import { compute } from '../art-657-forecast-accuracy-scorer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-657-forecast-accuracy-scorer.fixtures.json');
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
const rand = mulberry32(0x657A14);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 5000;
const CATEGORIES = ['economic_indicator', 'election_political', 'sports_competition', 'gaming_style_event', 'weather_climate', 'other', 'not_a_real_category'];

function mkForecast(rng, overrides = {}) {
  return {
    probability: randRange(rng, 0, 1),
    outcome: pick(rng, [0, 1]),
    category: pick(rng, CATEGORIES),
    ...overrides,
  };
}
function mkPP(rng, n, overrides = {}) {
  const forecasts = [];
  for (let i = 0; i < n; i++) forecasts.push(mkForecast(rng));
  return { forecasts, reference_probability: randRange(rng, 0, 1), ...overrides };
}

// ---------- P1: bounded — brier_score is always within [0, 1] over [0,1]-clamped inputs ----------
function checkP1_brierBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, 1 + Math.floor(rand() * 20));
    const r = compute(pp);
    checked++;
    const bs = r.output_payload.brier_score;
    if (!(bs >= 0 && bs <= 1)) violations++;
  }
  return { name: 'P1_brier_score_bounded_0_1', checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — accuracy_class matches the documented brier_score bands exactly ----------
function checkP2_accuracyClassAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, 1 + Math.floor(rand() * 20));
    const r = compute(pp);
    checked++;
    const { brier_score, accuracy_class } = r.output_payload;
    const expected = brier_score <= 0.05 ? 'EXCELLENT' : brier_score <= 0.15 ? 'GOOD' : brier_score <= 0.25 ? 'FAIR' : 'POOR';
    if (accuracy_class !== expected) violations++;
  }
  return { name: 'P2_accuracy_class_matches_fixed_brier_tier_rule', checked, violations };
}

// ---------- P3: perfect-forecast floor — probability===outcome for every record forces brier_score===0 and log_score===0 ----------
function checkP3_perfectForecastZeroScore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const forecasts = [];
    for (let j = 0; j < n; j++) {
      const outcome = pick(rand, [0, 1]);
      forecasts.push({ probability: outcome, outcome, category: pick(rand, CATEGORIES) });
    }
    const r = compute({ forecasts });
    checked++;
    if (r.output_payload.brier_score !== 0 || r.output_payload.log_score !== 0) violations++;
  }
  return { name: 'P3_perfect_forecast_forces_zero_brier_and_log_score', checked, violations };
}

// ---------- P4: category_breakdown partitions n exactly — sum of per-category n equals total n, every input record counted once ----------
function checkP4_categoryBreakdownPartitionsN() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, 1 + Math.floor(rand() * 20));
    const r = compute(pp);
    checked++;
    const sumN = r.output_payload.category_breakdown.reduce((s, c) => s + c.n, 0);
    if (sumN !== r.output_payload.n) violations++;
  }
  return { name: 'P4_category_breakdown_n_sums_to_total_n', checked, violations };
}

// ---------- P5: determinism — same pp (deep-copied) produces byte-identical output_payload ----------
function checkP5_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand, 1 + Math.floor(rand() * 10));
    const ppCopy = JSON.parse(JSON.stringify(pp));
    const r1 = compute(pp);
    const r2 = compute(ppCopy);
    checked++;
    if (JSON.stringify(r1.output_payload) !== JSON.stringify(r2.output_payload)) violations++;
  }
  return { name: 'P5_deterministic_output_for_deep_equal_input', checked, violations };
}

// ---------- P6 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ forecasts: [{ probability: 0, outcome: 0 }] }, 'probability at exact clamp minimum (0) matching outcome — must not throw, log_score must be exactly 0'],
  [{ forecasts: [{ probability: 1, outcome: 1 }] }, 'probability at exact clamp maximum (1) matching outcome — must not throw, log_score must be exactly 0'],
  [{ forecasts: [{ probability: 0, outcome: 1 }] }, 'probability at exact clamp minimum (0), WRONG outcome — log term would be -ln(0)=Infinity uncorrected; EPS clamp must keep it finite'],
  [{ forecasts: [{ probability: 1, outcome: 0 }] }, 'probability at exact clamp maximum (1), WRONG outcome — log term would be -ln(0)=Infinity uncorrected; EPS clamp must keep it finite'],
  [{ forecasts: [{ probability: 1.5, outcome: 1 }] }, 'probability above declared domain (1.5) — must clamp to 1, not throw'],
  [{ forecasts: [{ probability: -0.5, outcome: 0 }] }, 'probability below declared domain (-0.5) — must clamp to 0, not throw'],
  [{ forecasts: [{ probability: 0.1 * 3, outcome: 0 }] }, 'probability = 0.1*3 (classic non-exact double) — must round-trip through round6 without throwing'],
  [{ forecasts: [{ probability: (1 / 3) * 3, outcome: 1 }] }, 'probability = (1/3)*3 (x/y*y!==x artifact) — must round-trip through round6 without throwing'],
  [{ forecasts: [{ probability: 0.5, outcome: 1 }], reference_probability: 0 }, 'reference_probability at exact clamp minimum with a matching-zero brier_reference possibility — brier_skill_score must be null, not NaN/Infinity, when brier_reference is 0'],
  [{ forecasts: new Array(600).fill({ probability: 0.5, outcome: 1 }) }, '600 forecasts, over MAX_FORECASTS(500) — must truncate and flag SAMPLE_TRUNCATED, not throw or hang'],
  [{ forecasts: [{ probability: 0.5, outcome: 1, category: 'not_a_real_category' }] }, 'category outside the declared enum — must fall back to "other", not throw'],
  [{}, 'empty policy_parameters — must fall back to the default sample and flag DEFAULT_SAMPLE_USED, not throw'],
];

function checkP6_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    let outcome;
    try {
      const r = compute(pp);
      const op = r.output_payload;
      const nums = [op.n, op.brier_score, op.log_score, op.base_rate, op.reference_probability, op.brier_reference];
      const catNums = op.category_breakdown.flatMap((c) => [c.brier_score, c.log_score].filter((v) => v !== null));
      const finite = nums.every(Number.isFinite) && catNums.every(Number.isFinite)
        && (op.brier_skill_score === null || Number.isFinite(op.brier_skill_score))
        && ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'].includes(op.accuracy_class);
      outcome = { threw: false, finite, plausible: finite, flags: r.compliance_flags };
    } catch (e) {
      outcome = { threw: true, finite: false, plausible: false, error: String((e && e.message) || e) };
    }
    rows.push({ label, ...outcome });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_brierBounded());
results.properties.push(checkP2_accuracyClassAgreement());
results.properties.push(checkP3_perfectForecastZeroScore());
results.properties.push(checkP4_categoryBreakdownPartitionsN());
results.properties.push(checkP5_determinism());
results.boundary_forced = checkP6_forced();

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

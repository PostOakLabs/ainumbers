// art-263-score-cash-forecast-accuracy.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:624814c99e28e6097a9caa57f6273ad1edc0501ba9c8e8473ca8a1caff6b94e6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (MAPE/bias divide by |actual|, ULP-forced below —
// a near-zero-but-nonzero actual is NOT skipped by the kernel's `actual === 0` guard, so this is the
// prime ULP-boundary candidate). Checks: fixture-oracle gate, termination (buckets bounded by
// forecasts.length), boundedness (mape_pct/bias_pct finite unless actual near-zero blows them up —
// documented, not asserted-bounded), ULP-boundary forcing (actual exactly 0, actual = Number.MIN_VALUE,
// negative zero, denormal forecast), and a metamorphic permutation-invariance check on overall_mape_pct
// (forecast order must not change the aggregate score).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-263-score-cash-forecast-accuracy.proptest.mjs

import { compute } from '../art-263-score-cash-forecast-accuracy.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-263-score-cash-forecast-accuracy.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x263A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 5000;

// Deliberately avoids near-zero actuals so P1-P3/P5 exercise the well-behaved region; the near-zero
// pathology is covered explicitly and only in the forced P4 set.
function randomForecast(rng) {
  return { actual_amount: randRange(rng, 100, 1e7), forecast_amount: randRange(rng, 100, 1e7), horizon_days: randRange(rng, 0, 100) };
}

// ---------- P1: termination — bucket assignment and total_observations bounded by forecasts.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(randRange(rand, 0, 200));
    const forecasts = Array.from({ length: n }, () => randomForecast(rand));
    const output_payload = compute({ forecasts });
    checked++;
    if (output_payload.total_observations > n) violations++;
    if (output_payload.skipped_zero_actual !== n - output_payload.total_observations) violations++;
    const bucketSum = Object.values(output_payload.by_horizon).reduce((s, b) => s + b.n, 0);
    if (bucketSum > n) violations++;
  }
  return { name: 'P1_termination_bounded_by_forecast_count', trials: checked, violations };
}

// ---------- P2: boundedness — well-behaved region: mape_pct/bias_pct finite, tier in the known set ----------
function checkP2_boundedness() {
  const KNOWN_TIERS = ['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'POOR', 'INSUFFICIENT_DATA'];
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(randRange(rand, 0, 20));
    const forecasts = Array.from({ length: n }, () => randomForecast(rand));
    const output_payload = compute({ forecasts });
    checked++;
    if (!Number.isFinite(output_payload.overall_mape_pct)) violations++;
    if (!Number.isFinite(output_payload.overall_bias_pct)) violations++;
    if (output_payload.overall_mape_pct < 0) violations++;
    if (!KNOWN_TIERS.includes(output_payload.overall_accuracy_tier)) violations++;
  }
  return { name: 'P2_boundedness_finite_mape_known_tier', trials: checked, violations };
}

// ---------- P3: differential — accuracy tier re-derived independently from mape_pct thresholds ----------
function classifyTier(mape) {
  if (mape < 5) return 'EXCELLENT';
  if (mape < 10) return 'GOOD';
  if (mape < 20) return 'ACCEPTABLE';
  return 'POOR';
}
function checkP3_tier_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(randRange(rand, 0, 20));
    const forecasts = Array.from({ length: n }, () => randomForecast(rand));
    const output_payload = compute({ forecasts });
    checked++;
    if (output_payload.overall_accuracy_tier !== classifyTier(output_payload.overall_mape_pct)) violations++;
  }
  return { name: 'P3_tier_classification_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) ----------
const ULP_BOUNDARY_CASES = [
  { label: 'actual exactly zero -> guarded (skipped_zero_actual)', forecasts: [{ actual_amount: 0, forecast_amount: 100, horizon_days: 1 }], expectFinite: true },
  { label: 'actual negative-zero -> guarded same as zero (=== match)', forecasts: [{ actual_amount: -0, forecast_amount: 100, horizon_days: 1 }], expectFinite: true },
  // NOT guarded: actual = Number.MIN_VALUE is nonzero, so the `actual === 0` skip does not fire and
  // |actual-forecast|/|actual| overflows to Infinity — a genuine floor finding (documented, not a kernel
  // edit; fence forbids touching the kernel). MAPE is NOT boundedness-guaranteed for near-zero actuals;
  // expectFinite:false records that this case is KNOWN non-finite rather than silently passing/failing.
  { label: 'actual = Number.MIN_VALUE (near-zero, unguarded) -> MAPE overflows to Infinity (KNOWN non-finite)', forecasts: [{ actual_amount: Number.MIN_VALUE, forecast_amount: 100, horizon_days: 1 }], expectFinite: false },
  { label: 'forecast = actual exactly -> zero MAPE/bias', forecasts: [{ actual_amount: 5000, forecast_amount: 5000, horizon_days: 1 }], expectFinite: true },
  { label: 'denormal forecast, normal actual', forecasts: [{ actual_amount: 1000, forecast_amount: Number.MIN_VALUE, horizon_days: 1 }], expectFinite: true },
  { label: 'horizon exactly at T+1/T+7 boundary (1 vs 2 days)', forecasts: [{ actual_amount: 1000, forecast_amount: 1010, horizon_days: 1 }, { actual_amount: 1000, forecast_amount: 1010, horizon_days: 2 }], expectFinite: true },
  { label: 'no forecasts at all -> INSUFFICIENT_DATA', forecasts: [], expectFinite: true },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute(c);
    const actuallyFinite = output_payload.overall_mape_pct === null || Number.isFinite(output_payload.overall_mape_pct);
    rows.push({
      label: c.label,
      overall_mape_pct: Number.isFinite(output_payload.overall_mape_pct) ? output_payload.overall_mape_pct : String(output_payload.overall_mape_pct),
      overall_accuracy_tier: output_payload.overall_accuracy_tier,
      finite: actuallyFinite === c.expectFinite,
    });
  }
  return rows;
}

// ---------- P5: metamorphic — permutation-invariance of overall_mape_pct under forecast reorder ----------
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(randRange(rand, 0, 25));
    const forecasts = Array.from({ length: n }, () => randomForecast(rand));
    const shuffled = forecasts.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute({ forecasts });
    const r2 = compute({ forecasts: shuffled });
    checked++;
    if (Math.abs(r1.overall_mape_pct - r2.overall_mape_pct) > 0.01) violations++;
    if (r1.total_observations !== r2.total_observations) violations++;
  }
  return { name: 'P5_metamorphic_permutation_invariance_mape', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_tier_differential());
results.properties.push(checkP5_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-263-score-cash-forecast-accuracy',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);

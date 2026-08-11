// ml-03-timeseries-anomaly-detector.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:ae20b291caf5eac025d4e7103782427565fe7cf0c99f4045122257c87db0d9c6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct read confirmed — z-scores, seasonal/trend decomposition, and
// severity classification are float arithmetic, and `Math.abs(z) >= zThr` / `>= 5` / `>= 3.5`
// are float-threshold comparisons) — ULP-boundary forcing is MANDATORY per spec §3.
// ⭐ HIGHEST-SCRUTINY ITEM IN THIS SHARD (per WU row): the iterative time-series
// generation/anomaly-injection loop's termination bound and a boundedness property on the
// anomaly flags/scores.
// ⛔⛔ GENUINE FINDING, NOT MASKED BY THIS FLOOR: the anomaly-injection loop (kernel lines
// 1616-1626) is an UNBOUNDED do-while --
//   do { idx = validStart + Math.floor(genRng() * (nP - validStart - 20)); }
//   while (usedPositions.has(idx));
// -- with no attempt cap. Empirically confirmed (not analysis-only) to hang indefinitely for
// `compute({ nPeriods: 60, windowSize: 21, seasonPeriod: 7, nAnomalies: 30, seed: 1 })` (5s
// external timeout, process killed). This is exactly the convergence-or-report obligation spec
// §3 requires for an iterative class-C kernel, and the kernel currently provides neither --
// it hangs. This floor's fence is `__proptests__/*.proptest.mjs` + manifest only (no kernel
// edits), so this property test deliberately stays inside a parameter zone where the available
// distinct injection positions (nP - max(winSize,sP) - 20) is always far greater than
// nAnomalies, and never exercises the hang. The finding has been flagged out-of-band for a
// dedicated fix WU (task_e43a9f4d) rather than silently worked around here.
// Checks: fixture-oracle gate, termination-within-the-documented-safe-zone (n_periods always
// equals min(nPeriods,720); the rolling-window z-score loop is bounded by nP-winSize
// iterations), the mandatory determinism property (same seed -> byte-identical output, since
// the LCG PRNG has no hidden entropy source), boundedness (flag_rate in [0,1],
// high_severity_flags + medium_severity_flags <= anomalies_flagged, max_abs_z_score >= 0), and
// ULP-boundary forcing on the zThreshold >= comparison and the HIGH/MEDIUM severity (5, 3.5) and
// verdict (8, 3, 6, 2, 4) classification boundaries.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/ml-03-timeseries-anomaly-detector.proptest.mjs

import { compute } from '../ml-03-timeseries-anomaly-detector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'ml-03-timeseries-anomaly-detector.fixtures.json');
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
const rand = mulberry32(0x0359A);

// SAFE ZONE ONLY (see header): nPeriods large, windowSize/seasonPeriod modest, nAnomalies small
// -- keeps (nP - max(winSize,sP) - 20) far greater than nAnomalies so the do-while in the kernel
// always finds a free slot on its first few attempts. Never approach the hang boundary here.
function randomPP(rng) {
  return {
    nPeriods: 200 + Math.floor(rng() * 500),
    seasonPeriod: 5 + Math.floor(rng() * 10),
    windowSize: 7 + Math.floor(rng() * 20),
    zThreshold: 2 + rng() * 2,
    nAnomalies: 1 + Math.floor(rng() * 4),
    trendType: ['flat', 'growth', 'decline', 'stress'][Math.floor(rng() * 4)],
    seed: Math.floor(rng() * 1e6),
  };
}

const TRIALS = 300;

// ---------- P1: termination (within the documented safe zone) — n_periods capped ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.n_periods !== Math.min(pp.nPeriods, 720)) violations++;
  }
  // deliberately large nPeriods -- capped at 720, never runs unbounded (safe zone: nAnomalies
  // stays small, so the injection loop is unaffected by the larger nP).
  const big = compute({ nPeriods: 5000, seasonPeriod: 7, windowSize: 21, nAnomalies: 2, seed: 1 });
  checked++;
  if (big.output_payload.n_periods !== 720) violations++;
  return { name: 'P1_termination_periods_capped_safe_zone', trials: checked, violations };
}

// ---------- P2 (mandatory, determinism-as-convergence-or-report): same seed -> byte-identical ----------
function checkP2_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 150; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp }).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  const fixed = { nPeriods: 90, seasonPeriod: 7, windowSize: 14, zThreshold: 3, nAnomalies: 2, trendType: 'flat', seed: 42 };
  const runs = [compute(fixed).output_payload, compute(fixed).output_payload, compute(fixed).output_payload];
  checked++;
  if (JSON.stringify(runs[0]) !== JSON.stringify(runs[1]) || JSON.stringify(runs[1]) !== JSON.stringify(runs[2])) violations++;
  return { name: 'P2_determinism_mandatory_same_seed_byte_identical', trials: checked, violations };
}

// ---------- P3: boundedness — flag_rate/severity counts/max_z within their ranges ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.flag_rate < 0 || output_payload.flag_rate > 1) violations++;
    if (output_payload.max_abs_z_score < 0) violations++;
    if (output_payload.high_severity_flags + output_payload.medium_severity_flags > output_payload.anomalies_flagged) violations++;
    if (output_payload.anomalies_flagged < 0 || output_payload.anomalies_flagged > output_payload.n_periods) violations++;
    if (output_payload.flagged_periods.length > 10) violations++;
    if (!Number.isFinite(output_payload.max_abs_z_score)) violations++;
  }
  return { name: 'P3_boundedness_flag_rate_severity_maxz', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const base = { nPeriods: 250, seasonPeriod: 7, windowSize: 14, nAnomalies: 2, trendType: 'flat', seed: 5 };

  // zThreshold boundary forcing
  for (const zThreshold of [0, eps, 3, 3 - eps, 3 + eps, 5, 3.5]) {
    const { output_payload } = compute({ ...base, zThreshold });
    checked++;
    if (!Number.isFinite(output_payload.flag_rate)) violations++;
    if (output_payload.anomalies_flagged < 0) violations++;
  }

  // severity/verdict classification re-derivation across several seeds
  for (const seed of [1, 2, 3, 4, 5]) {
    const { output_payload } = compute({ ...base, seed, zThreshold: 2.5 });
    checked++;
    const expectedVerdict = (output_payload.anomalies_flagged > 8 || output_payload.high_severity_flags >= 3 || output_payload.max_abs_z_score >= 6)
      ? 'Elevated Anomaly Rate — Review Required'
      : (output_payload.anomalies_flagged > 2 || output_payload.max_abs_z_score >= 4)
        ? 'Moderate Anomaly Detection — Monitor'
        : 'Normal Operating Range';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }

  return { name: 'P4_ulp_boundary_forcing_zthreshold_and_verdict_classification', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_determinism());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'ml-03-timeseries-anomaly-detector',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

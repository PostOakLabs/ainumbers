// art-429-var-backtest-traffic-light.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:25b20c0e87bf44b54d5c7f92e3ac4994db2af88a5fcb98ee3755972234fafe6b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct source read confirmed — exception detection is a strict `<`
// P&L-vs-VaR comparison feeding an INTEGER exception count, then a fixed lookup table over
// that integer; no rounding, no division, no ULP-sensitive threshold arithmetic). Forced
// categorical boundary cases (exception_count 0/4/5/9/10/11, the exact Basel zone edges)
// are used instead of ULP-forcing, per spec §3's float:no row.
// Checks: fixture-oracle gate, termination (window_days/exception_count bounded by input
// observations array length, truncation to 250), boundedness (zone in the fixed enum,
// multiplier in the fixed table range), differential re-derivation of exception_count/zone/
// multiplier, metamorphic append-invariance (appending a non-exception observation never
// changes the exception count), forced categorical zone-boundary cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-429-var-backtest-traffic-light.proptest.mjs

import { compute } from '../art-429-var-backtest-traffic-light.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-429-var-backtest-traffic-light.fixtures.json');
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
const rand = mulberry32(0x429A0);

const MULTIPLIER_TABLE = [3.00, 3.00, 3.00, 3.00, 3.00, 3.40, 3.50, 3.65, 3.75, 3.85];

function randomObservations(rng, n, exceptionRatio) {
  return Array.from({ length: n }, () => {
    const var_estimate = 1 + rng() * 100;
    return rng() < exceptionRatio
      ? { pnl: -(var_estimate + 1 + rng() * 10), var_estimate }
      : { pnl: -(var_estimate * rng()), var_estimate };
  });
}

function randomPP(rng) {
  const n = Math.floor(rng() * 400);
  const exceptionRatio = rand() < 0.5 ? 0 : rand() * 0.1;
  return { observations: randomObservations(rng, n, exceptionRatio) };
}

const TRIALS = 5000;

// ---------- P1: termination — window_days bounded by input length, truncated to 250 ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedWindow = Math.min(pp.observations.length, 250);
    if (output_payload.window_days !== expectedWindow) violations++;
    if (output_payload.exception_count > output_payload.window_days) violations++;
  }
  return { name: 'P1_termination_window_bounded_and_truncated_to_250', trials: checked, violations };
}

// ---------- P2: boundedness — zone in fixed enum, multiplier in fixed range ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const ZONES = new Set(['GREEN', 'YELLOW', 'RED']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!ZONES.has(output_payload.zone)) violations++;
    if (!(output_payload.multiplier >= 3.00 && output_payload.multiplier <= 4.00)) violations++;
  }
  return { name: 'P2_boundedness_zone_enum_and_multiplier_range', trials: checked, violations };
}

// ---------- P3 (differential): exception_count / zone / multiplier re-derivation ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const window = pp.observations.length > 250 ? pp.observations.slice(-250) : pp.observations;
    const expectedCount = window.filter((o) => o.pnl < -Math.abs(o.var_estimate)).length;
    if (output_payload.exception_count !== expectedCount) violations++;
    const expectedZone = expectedCount >= 10 ? 'RED' : (expectedCount >= 5 ? 'YELLOW' : 'GREEN');
    if (output_payload.zone !== expectedZone) violations++;
    const expectedMult = expectedCount >= 10 ? 4.00 : MULTIPLIER_TABLE[expectedCount];
    if (output_payload.multiplier !== expectedMult) violations++;
  }
  return { name: 'P3_exception_zone_multiplier_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — appending a clean (non-exception) observation never changes exception_count when window doesn't yet exceed 250 ----------
function checkP4_append_clean_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 240);
    const obs = randomObservations(rand, n, rand() * 0.1);
    const r1 = compute({ observations: obs }).output_payload;
    const extended = { observations: [...obs, { pnl: -1, var_estimate: 1000 }] };
    const r2v = compute(extended).output_payload;
    checked++;
    if (r2v.exception_count !== r1.exception_count) violations++;
    if (r2v.window_days !== r1.window_days + 1) violations++;
  }
  return { name: 'P4_append_clean_observation_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases — Basel zone edges (float:no substitute for ULP-forcing) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const boundaryCounts = [0, 4, 5, 9, 10, 11, 250];
  for (const count of boundaryCounts) {
    checked++;
    const observations = Array.from({ length: 250 }, (_, i) => (
      i < count ? { pnl: -20, var_estimate: 10 } : { pnl: 0, var_estimate: 10 }
    ));
    const { output_payload } = compute({ observations });
    const expectedZone = count >= 10 ? 'RED' : (count >= 5 ? 'YELLOW' : 'GREEN');
    if (output_payload.zone !== expectedZone) violations++;
    if (output_payload.exception_count !== count) violations++;
  }
  return { name: 'P5_forced_categorical_zone_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_append_clean_metamorphic());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-429-var-backtest-traffic-light',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

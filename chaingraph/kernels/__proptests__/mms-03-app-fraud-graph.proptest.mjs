// mms-03-app-fraud-graph.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:e4475d26f24233cd44e35864937108b85615179add6786403c54a4540d903def
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo BFS propagation over an LCG PRNG, detection_rate/psr_threshold
// float comparisons, direct read confirmed) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (n_paths structurally clamped to [10,2000] regardless of
// requested value, BFS reach bounded by the fixed topology node count), boundedness (all reach/breach
// probabilities in [0,1]), seed-determinism metamorphic (same pp -> byte-identical output, twice), and
// ULP-boundary forcing on detection_rate/psr_threshold.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/mms-03-app-fraud-graph.proptest.mjs

import { compute } from '../mms-03-app-fraud-graph.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'mms-03-app-fraud-graph.fixtures.json');
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
const rand = mulberry32(0x1103a0);
const TOPOLOGIES = ['retail_network', 'corporate_sweep', 'mule_dense'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    topology: pick(rng, TOPOLOGIES),
    n_paths: Math.floor(rng() * 4000) - 1000, // deliberately spans outside [10,2000] both ends
    detection_rate: rng(),
    psr_threshold: Math.floor(rng() * 200000),
    seed: Math.floor(rng() * 1e9),
  };
}

const TRIALS = 3000;

// ---------- P1: termination — n_paths structurally clamped to [10,2000] ----------
function checkP1_termination_npaths_clamp() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.n_paths < 10 || output_payload.n_paths > 2000) violations++;
  }
  return { name: 'P1_termination_n_paths_clamped_10_to_2000', trials: checked, violations };
}

// ---------- P2: boundedness — every probability field stays in [0,1] ----------
function checkP2_boundedness_probabilities() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.psr_threshold_breach_probability < 0 || output_payload.psr_threshold_breach_probability > 1) violations++;
    for (const v of Object.values(output_payload.node_reach_probabilities)) {
      if (v < 0 || v > 1) { violations++; break; }
    }
  }
  return { name: 'P2_boundedness_probabilities_in_0_1', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P3_seed_determinism_metamorphic', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const detectionRateForced = [0, -0, eps, 1 - eps, 1, Number.MIN_VALUE, 1e-300];
  for (const dr of detectionRateForced) {
    const output_payload = compute({ topology: 'retail_network', n_paths: 100, detection_rate: dr, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.psr_threshold_breach_probability)) violations++;
    if (output_payload.n_paths !== 100) violations++;
  }
  const thresholdForced = [0, -0, eps, Number.MIN_VALUE, 85000 - eps, 85000 + eps, 1e300];
  for (const th of thresholdForced) {
    const output_payload = compute({ topology: 'corporate_sweep', n_paths: 100, psr_threshold: th, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.psr_threshold_breach_probability)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_detection_rate_and_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_npaths_clamp());
results.properties.push(checkP2_boundedness_probabilities());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'mms-03-app-fraud-graph',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

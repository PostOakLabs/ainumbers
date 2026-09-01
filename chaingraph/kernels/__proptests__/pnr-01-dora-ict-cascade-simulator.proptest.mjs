// pnr-01-dora-ict-cascade-simulator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:748f40841c60b16c54741966869e7515cc7259dc78c0efc7c68f6de6068071df
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo cascade propagation, cascade_threshold folded into the LCG seed
// via bitwise ^ on a rounded float, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// Checks: fixture-oracle gate, termination (n_paths structurally clamped to [50,2000]), boundedness
// (dora_reporting_probability and every node_cascade_probabilities entry in [0,1]), seed-determinism
// metamorphic (same pp -> byte-identical output, twice), and ULP-boundary forcing on cascade_threshold.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/pnr-01-dora-ict-cascade-simulator.proptest.mjs

import { compute } from '../pnr-01-dora-ict-cascade-simulator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'pnr-01-dora-ict-cascade-simulator.fixtures.json');
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
const rand = mulberry32(0x1103a1);
const TOPOLOGIES = ['bank_core', 'cloud_native', 'legacy_hybrid'];
const MTTR = ['fast', 'standard', 'slow'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    topology: pick(rng, TOPOLOGIES),
    mttr_profile: pick(rng, MTTR),
    cascade_threshold: rng(),
    n_paths: Math.floor(rng() * 4000) - 1000, // deliberately spans outside [50,2000] both ends
    seed: Math.floor(rng() * 1e9),
  };
}

const TRIALS = 2000;

// ---------- P1: termination — n_paths structurally clamped to [50,2000] ----------
function checkP1_termination_npaths_clamp() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.n_paths < 50 || output_payload.n_paths > 2000) violations++;
  }
  return { name: 'P1_termination_n_paths_clamped_50_to_2000', trials: checked, violations };
}

// ---------- P2: boundedness — every cascade probability stays in [0,1] ----------
function checkP2_boundedness_probabilities() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.dora_reporting_probability < 0 || output_payload.dora_reporting_probability > 1) violations++;
    for (const v of Object.values(output_payload.node_cascade_probabilities)) {
      if (v < 0 || v > 1) { violations++; break; }
    }
  }
  return { name: 'P2_boundedness_probabilities_in_0_1', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
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
  const cascadeForced = [0, -0, eps, 1 - eps, 1, Number.MIN_VALUE, 0.5 - eps, 0.5 + eps];
  for (const ct of cascadeForced) {
    const { output_payload } = compute({ topology: 'bank_core', n_paths: 100, cascade_threshold: ct, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.dora_reporting_probability)) violations++;
    if (output_payload.n_paths !== 100) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_cascade_threshold', trials: checked, violations };
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
  tool_id: 'pnr-01-dora-ict-cascade-simulator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// rca-02-mica-reserve-stress.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:c66896024cd7ffc75c46cdd7c67e42c929234c4c7ce4b342a372b3627a68377b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo reserve-coverage path simulation over an LCG PRNG,
// reserve_ratio_init/art36_buffer float comparisons, direct read confirmed) — ULP-boundary forcing is
// MANDATORY.
// Checks: fixture-oracle gate, termination (n_paths structurally clamped to [50,2000]; horizon_days
// is the caller-declared per-day inner-loop bound, a class-C data-dependent-loop shape), boundedness
// (breach_probability_pct/peak_breach_pct/art36_buffer_adequate_pct all in [0,100]), seed-determinism
// metamorphic (same pp -> byte-identical output, twice), and ULP-boundary forcing on
// reserve_ratio_init/art36_buffer.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/rca-02-mica-reserve-stress.proptest.mjs

import { compute } from '../rca-02-mica-reserve-stress.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'rca-02-mica-reserve-stress.fixtures.json');
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
const rand = mulberry32(0x1103a7);
const SCENARIOS = ['mild', 'moderate', 'severe'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    scenario: pick(rng, SCENARIOS),
    // kept small (compute cost is O(n_paths * horizon_days)); the upper clamp [2000] is exercised
    // directly by the boundary probe in P1 instead — deliberately spans outside [50,2000] at the
    // LOW end here to prove the floor of the clamp works too.
    n_paths: Math.floor(rng() * 100) - 20,
    horizon_days: Math.floor(rng() * 20) + 1,
    reserve_ratio_init: 1 + rng() * 0.3,
    art36_buffer: rng() * 0.1,
    seed: Math.floor(rng() * 1e9),
  };
}

const TRIALS = 60;

// ---------- P1: termination — n_paths structurally clamped to [50,2000] ----------
function checkP1_termination_npaths_clamp() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.n_paths < 50 || output_payload.n_paths > 2000) violations++;
    if (output_payload.horizon_days !== pp.horizon_days) violations++;
  }
  // direct upper-bound probe (kept out of the random loop for compute-cost reasons)
  {
    const { output_payload } = compute({ n_paths: 5000, horizon_days: 5, seed: 1 });
    checked++;
    if (output_payload.n_paths > 2000) violations++;
  }
  return { name: 'P1_termination_n_paths_clamped_horizon_bound_equals_input', trials: checked, violations };
}

// ---------- P2: boundedness — every pct field in [0,100] ----------
function checkP2_boundedness_pct_fields() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.breach_probability_pct < 0 || output_payload.breach_probability_pct > 100) violations++;
    if (output_payload.peak_breach_pct < 0 || output_payload.peak_breach_pct > 100) violations++;
    if (![0, 100].includes(output_payload.art36_buffer_adequate_pct)) violations++;
  }
  return { name: 'P2_boundedness_pct_fields_in_0_100', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rand);
    const r1 = JSON.stringify(compute(pp));
    const r2 = JSON.stringify(compute(pp));
    checked++;
    if (r1 !== r2) violations++;
  }
  return { name: 'P3_seed_determinism_metamorphic', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const reserveForced = [1, 1 - eps, 1 + eps, 1.05 - eps, 1.05 + eps, Number.MIN_VALUE, 0, -0];
  for (const rr of reserveForced) {
    const { output_payload } = compute({ reserve_ratio_init: rr, n_paths: 100, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.breach_probability_pct)) violations++;
    if (output_payload.n_paths !== 100) violations++;
  }
  const bufferForced = [0, -0, eps, 0.02 - eps, 0.02 + eps, Number.MIN_VALUE, 1e-300];
  for (const buf of bufferForced) {
    const { output_payload } = compute({ art36_buffer: buf, n_paths: 100, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.breach_probability_pct)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_reserve_ratio_and_buffer', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_npaths_clamp());
results.properties.push(checkP2_boundedness_pct_fields());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'rca-02-mica-reserve-stress',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

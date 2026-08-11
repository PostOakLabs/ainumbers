// sim-01-lcr-nsfr-liquidity-stress-test.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:e22635c466fd20d5fb8ff61aa494e70f70f958e303b5d52a90e0f0f22a6e930e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo LCR/NSFR path simulation over an LCG PRNG, ratio comparisons
// against the 1.0 regulatory minimum, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// Checks: fixture-oracle gate, termination (n_paths structurally clamped to [50,2000]; the LCR/NSFR
// inner loops use the kernel's own fixed T_LCR=30/T_NSFR=250 constants, not caller input), boundedness
// (lcr_breach_pct/nsfr_breach_pct in [0,100]), seed-determinism metamorphic (same pp -> byte-identical
// output, twice), and ULP-boundary forcing on the outflow/hqla parameters that feed the 1.0 threshold
// comparison.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/sim-01-lcr-nsfr-liquidity-stress-test.proptest.mjs

import { compute } from '../sim-01-lcr-nsfr-liquidity-stress-test.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'sim-01-lcr-nsfr-liquidity-stress-test.fixtures.json');
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
const rand = mulberry32(0x1103a9);
const SCENARIOS = ['mild', 'moderate', 'severe'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    scenario: pick(rng, SCENARIOS),
    // kept small (compute cost is O(n_paths * (T_LCR + T_NSFR)) = O(n_paths * 280), fixed by the
    // kernel, not caller input); the upper clamp [2000] is exercised directly by the boundary probe
    // in P1 — deliberately spans outside [50,2000] at the LOW end here.
    n_paths: Math.floor(rng() * 100) - 20,
    hqla_l1: rng() * 50,
    hqla_l2a: rng() * 20,
    hqla_l2b: rng() * 10,
    retail_outflow: rng() * 20,
    wholesale_outflow: rng() * 30,
    secured_outflow: rng() * 20,
    inflows: rng() * 40,
    asf_cap: rng() * 150,
    rsf_loans: rng() * 100,
    rsf_securities: rng() * 40,
    rsf_other: rng() * 30,
    seed: Math.floor(rng() * 1e9),
  };
}

const TRIALS = 100;

// ---------- P1: termination — n_paths structurally clamped to [50,2000] ----------
function checkP1_termination_npaths_clamp() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.n_paths < 50 || output_payload.n_paths > 2000) violations++;
  }
  {
    const output_payload = compute({ n_paths: 5000, seed: 1 });
    checked++;
    if (output_payload.n_paths > 2000) violations++;
  }
  return { name: 'P1_termination_n_paths_clamped_50_to_2000', trials: checked, violations };
}

// ---------- P2: boundedness — breach percentages in [0,100] ----------
function checkP2_boundedness_breach_pct() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.lcr_breach_pct < 0 || output_payload.lcr_breach_pct > 100) violations++;
    if (output_payload.nsfr_breach_pct < 0 || output_payload.nsfr_breach_pct > 100) violations++;
    if (!Number.isFinite(output_payload.lcr_median_day30) || !Number.isFinite(output_payload.nsfr_median_day250)) violations++;
  }
  return { name: 'P2_boundedness_breach_pct_in_0_100', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 80; i++) {
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
  const hqlaForced = [0, -0, eps, Number.MIN_VALUE, 1e-300, 20 - eps, 20 + eps];
  for (const h of hqlaForced) {
    const output_payload = compute({ hqla_l1: h, n_paths: 60, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.lcr_median_day30)) violations++;
    if (output_payload.n_paths !== 60) violations++;
  }
  const outflowForced = [0, -0, eps, Number.MIN_VALUE, 5 - eps, 5 + eps];
  for (const o of outflowForced) {
    const output_payload = compute({ retail_outflow: o, n_paths: 60, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.lcr_median_day30)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_hqla_and_outflow', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_npaths_clamp());
results.properties.push(checkP2_boundedness_breach_pct());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'sim-01-lcr-nsfr-liquidity-stress-test',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

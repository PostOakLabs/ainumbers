// qfa-04-xva-cva-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:610e4753f0cc5efc58fe433b1ebc1277facbc7952b89439515a00493070bb3e0
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo exposure-path simulation over an LCG PRNG, deterministic exp/log
// integration, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// Checks: fixture-oracle gate, termination (n_paths structurally clamped to [50,2000], n_steps
// structurally clamped to [5,200]), boundedness/differential (xva === cva - dva + fva by direct
// recomputation from the emitted fields), seed-determinism metamorphic (same pp -> byte-identical
// output, twice), and ULP-boundary forcing on vol_pct/rfr_pct/cpyPD_pct.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/qfa-04-xva-cva-calculator.proptest.mjs

import { compute } from '../qfa-04-xva-cva-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'qfa-04-xva-cva-calculator.fixtures.json');
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
const rand = mulberry32(0x1103a5);
const INSTRUMENTS = ['irs', 'fx_forward', 'cds', undefined];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  return {
    instrument: pick(rng, INSTRUMENTS),
    notional: rng() * 5e7 + 1e5,
    maturity_years: rng() * 10 + 0.1,
    vol_pct: rng() * 60,
    rfr_pct: rng() * 10,
    cpyPD_pct: rng() * 10,
    cpyLGD_pct: rng() * 100,
    ownPD_pct: rng() * 5,
    funding_bps: rng() * 300,
    // kept small (compute cost is O(n_paths * n_steps); the kernel's own upper clamps [2000,200] are
    // exercised directly by the boundary probes in P1/P4 instead) — deliberately spans slightly
    // outside [50,2000] and [5,200] at the LOW end to prove the clamp floors work too.
    n_paths: Math.floor(rng() * 200) - 20,
    n_steps: Math.floor(rng() * 30) - 3,
    seed: Math.floor(rng() * 1e9),
  };
}

const TRIALS = 40;

// ---------- P1: termination — n_paths/n_steps structurally clamped ----------
function checkP1_termination_clamps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.n_paths < 50 || output_payload.n_paths > 2000) violations++;
    if (output_payload.n_steps < 5 || output_payload.n_steps > 200) violations++;
  }
  // direct upper-bound probes (kept out of the random loop for compute-cost reasons)
  for (const req of [{ n_paths: 5000, n_steps: 20 }, { n_paths: 100, n_steps: 400 }]) {
    const output_payload = compute({ ...req, seed: 1 });
    checked++;
    if (output_payload.n_paths > 2000) violations++;
    if (output_payload.n_steps > 200) violations++;
  }
  return { name: 'P1_termination_n_paths_and_n_steps_clamped', trials: checked, violations };
}

// ---------- P2 (differential): xva === cva - dva + fva ----------
function checkP2_xva_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    const expected = +(output_payload.cva - output_payload.dva + output_payload.fva).toFixed(2);
    if (Math.abs(expected - output_payload.xva) > 0.02) violations++;
    if (!Number.isFinite(output_payload.xva)) violations++;
  }
  return { name: 'P2_xva_differential_cva_minus_dva_plus_fva', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 30; i++) {
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
  const volForced = [0, -0, eps, Number.MIN_VALUE, 1e-300, 20 - eps, 20 + eps];
  for (const v of volForced) {
    const output_payload = compute({ vol_pct: v, n_paths: 100, n_steps: 20, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.xva)) violations++;
  }
  const rfrForced = [0, -0, eps, Number.MIN_VALUE, 4.5 - eps, 4.5 + eps];
  for (const r of rfrForced) {
    const output_payload = compute({ rfr_pct: r, n_paths: 100, n_steps: 20, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.xva)) violations++;
  }
  const pdForced = [0, -0, eps, Number.MIN_VALUE, 1.5 - eps, 1.5 + eps];
  for (const p of pdForced) {
    const output_payload = compute({ cpyPD_pct: p, n_paths: 100, n_steps: 20, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.xva)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_vol_rfr_cpyPD', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_clamps());
results.properties.push(checkP2_xva_differential());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'qfa-04-xva-cva-calculator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

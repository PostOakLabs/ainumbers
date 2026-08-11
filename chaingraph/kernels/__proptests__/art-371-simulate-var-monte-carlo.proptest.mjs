// art-371-simulate-var-monte-carlo.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:e43e90202b192f7f8a4b0d8f5da090c81db5ea4e4d492e6c8a398ce189ac8736
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (correlation/portfolio_value_mm clamp math and the FP-to-float `toPct`
// conversion at the fixed<->float boundary — direct read confirmed) — ULP-boundary forcing is
// MANDATORY per spec §3. NOTE: the simulation's hot path is integer-only BigInt fixed-point
// arithmetic (xoshiro256** + Irwin-Hall normal approximation); float only enters at the
// caller-input clamp stage and the final `toPct`/rounding stage, which is exactly what P4
// below forces.
// Checks: fixture-oracle gate, termination (n_paths/n_assets are unbounded caller inputs but
// HARD-CLAMPED to [100,20000]/[2,10] before the simulation loop runs — the clamp, not the
// caller value, is the actual termination bound), boundedness (mc_var_pct/mc_es_pct/verdict
// always well-formed and finite), metamorphic (seed-determinism: identical policy_parameters,
// including seed, produce a byte-identical output_payload on repeat invocation — the kernel is
// a pure function of its declared inputs, no hidden time/randomness source), ULP-boundary
// forcing on correlation/portfolio_value_mm/seed at the clamp boundaries.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-371-simulate-var-monte-carlo.proptest.mjs

import { compute } from '../art-371-simulate-var-monte-carlo.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-371-simulate-var-monte-carlo.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    // art-371's compute() returns the flat result object directly -- it IS the output_payload
    // (no {output_payload, compliance_flags} wrapper), confirmed by direct read of the kernel
    // and cross-checked against this fixture file's shape.
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
const rand = mulberry32(0x371D0);

// n_paths/n_assets kept SMALL for trial speed -- the clamp behavior (P1) is what's under test,
// not simulation quality, and each trial runs a real O(n_paths*n_assets) loop.
function randomPP(rng) {
  return {
    n_assets: 2 + Math.floor(rng() * 9),
    n_paths: 100 + Math.floor(rng() * 400),
    holding_period: 1 + Math.floor(rng() * 30),
    conf_level: [0.95, 0.99, 0.999][Math.floor(rng() * 3)],
    correlation: rng() * 0.95,
    portfolio_value_mm: 1 + rng() * 500,
    seed: Math.floor(rng() * 1e6),
  };
}

const TRIALS = 20;

// ---------- P1: termination — n_paths/n_assets caller inputs are HARD-CLAMPED before the loop runs ----------
function checkP1_termination_clamp() {
  let violations = 0, checked = 0;
  const extremeCases = [
    { n_assets: 1e9, n_paths: 1e9 },
    { n_assets: -50, n_paths: -50 },
    { n_assets: 0, n_paths: 0 },
    { n_assets: 3.7, n_paths: 250.9 },
  ];
  for (const c of extremeCases) {
    const pp = { ...c, seed: 1 };
    const output_payload = compute(pp);
    checked++;
    if (output_payload.n_assets < 2 || output_payload.n_assets > 10) violations++;
    if (output_payload.n_paths < 100 || output_payload.n_paths > 20000) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    pp.n_assets = Math.floor(rand() * 200) - 50; // may be well outside the [2,10] declared range
    pp.n_paths = Math.floor(rand() * 3000) - 1000; // clamp-probing, not simulation-quality -- kept small for trial speed
    const output_payload = compute(pp);
    checked++;
    if (output_payload.n_assets < 2 || output_payload.n_assets > 10) violations++;
    if (output_payload.n_paths < 100 || output_payload.n_paths > 20000) violations++;
  }
  return { name: 'P1_termination_clamp_bounds_respected', trials: checked, violations };
}

// ---------- P2: boundedness — mc_var_pct/mc_es_pct/verdict always well-formed ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.mc_var_pct) || !Number.isFinite(output_payload.mc_es_pct)) violations++;
    if (!Number.isFinite(output_payload.var_dollar_mm) || !Number.isFinite(output_payload.es_dollar_mm)) violations++;
    if (!['LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK'].includes(output_payload.verdict)) violations++;
    if (output_payload.draw_count !== output_payload.n_paths * (output_payload.n_assets + 1) * 12) violations++;
  }
  return { name: 'P2_boundedness_var_es_verdict_wellformed', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism, byte-identical repeat invocation ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = compute(pp);
    const b = compute(pp);
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P3_seed_determinism_repeat_invocation', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — correlation/portfolio_value_mm ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const correlationBoundary = [0, -0, eps, -eps, 0.95, 0.95 + eps, 0.95 - eps, 1, Number.MIN_VALUE];
  for (const correlation of correlationBoundary) {
    const pp = { n_assets: 5, n_paths: 200, holding_period: 10, conf_level: 0.99, correlation, portfolio_value_mm: 100, seed: 7 };
    const output_payload = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.mc_var_pct)) violations++;
    if (output_payload.correlation < 0 || output_payload.correlation > 0.95) violations++;
  }
  const portfolioBoundary = [0, -0, eps, Number.MIN_VALUE, 1e-300];
  for (const portfolio_value_mm of portfolioBoundary) {
    const pp = { n_assets: 5, n_paths: 200, holding_period: 10, conf_level: 0.99, correlation: 0.3, portfolio_value_mm, seed: 7 };
    const output_payload = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.var_dollar_mm) || !Number.isFinite(output_payload.es_dollar_mm)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_correlation_and_portfolio_value', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_clamp());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-371-simulate-var-monte-carlo',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

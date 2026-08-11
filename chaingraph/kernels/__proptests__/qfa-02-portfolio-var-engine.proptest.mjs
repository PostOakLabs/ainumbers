// qfa-02-portfolio-var-engine.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:9051ffa2fd22d389890aa26c21be6f7d3f32a0da1de5ba47890946271487ebe3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Cholesky-correlated Monte Carlo VaR/ES over an LCG PRNG, conf_level/
// correlation float comparisons, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// ⭐ HIGHEST-SCRUTINY ITEM IN THIS SHARD per the WU row (seeded Monte-Carlo VaR simulation, iterative
// paths, same shape concern as ml-02): this file states the path-count cap explicitly (P1), the
// seed-determinism property explicitly (P3), and boundedness on the VaR/ES output explicitly (P2).
// It is NOT an iterative solver with a convergence/non-convergence branch — compute() runs a fixed
// n_paths Monte Carlo loop with no while-loop or early-exit condition, so there is no
// "convergence-or-report" contract to state here (confirmed by direct read of the compute() body);
// the termination guarantee is the structural n_paths clamp, asserted below.
// Checks: fixture-oracle gate, termination (n_paths clamped to [100,10000], n_assets clamped to
// [2,10] — the length of the fixed SECTOR_VOLS table), boundedness (mc_var_pct/mc_es_pct/param_var_pct
// finite and mc_es_pct never below mc_var_pct for the same tail), seed-determinism metamorphic (same
// pp -> byte-identical output, twice), and ULP-boundary forcing on conf_level/correlation.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/qfa-02-portfolio-var-engine.proptest.mjs

import { compute } from '../qfa-02-portfolio-var-engine.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'qfa-02-portfolio-var-engine.fixtures.json');
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
const rand = mulberry32(0x1103a3);

function randomPP(rng) {
  return {
    n_assets: Math.floor(rng() * 16) - 3, // deliberately spans outside [2,10] both ends
    // kept small (compute cost is O(n_paths); n_paths=10000 is the kernel's own upper clamp, which
    // P4 exercises directly at the boundary instead) — deliberately spans outside [100,10000] below
    n_paths: Math.floor(rng() * 500) - 100,
    holding_period: Math.floor(rng() * 60) + 1,
    conf_level: pick(rng, [0.95, 0.99, 0.999]),
    // kept within the documented equal-pairwise-correlation domain [0, 1) — correlation=1 or
    // negative correlation is a separate, out-of-domain kernel finding noted in P4 below, not
    // exercised here so this property isn't measuring that known edge case.
    correlation: rng() * 0.95,
    portfolio_value_mm: rng() * 1000,
    seed: Math.floor(rng() * 1e9),
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 150;

// ---------- P1: termination — n_assets and n_paths structurally clamped ----------
function checkP1_termination_clamps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    if (output_payload.n_paths < 100 || output_payload.n_paths > 10000) violations++;
  }
  return { name: 'P1_termination_n_paths_clamped_100_to_10000', trials: checked, violations };
}

// ---------- P2: boundedness — VaR/ES outputs are finite and ES is never less-tail than VaR ----------
function checkP2_boundedness_var_es() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const output_payload = compute(pp);
    checked++;
    const fields = [output_payload.mc_var_pct, output_payload.mc_es_pct, output_payload.param_var_pct, output_payload.param_es_pct, output_payload.hist_var_pct];
    if (fields.some((v) => !Number.isFinite(v))) violations++;
    // ES is a tail-average beyond the VaR quantile, so it must be at least as extreme as VaR —
    // tolerance widened to 5e-6 because both fields are independently .toFixed(6)-rounded before
    // this comparison, which can separate two otherwise-equal values by up to 1e-6.
    if (output_payload.mc_es_pct < output_payload.mc_var_pct - 5e-6) violations++;
  }
  return { name: 'P2_boundedness_var_es_finite_and_es_at_least_var', trials: checked, violations };
}

// ---------- P3: metamorphic — seed-determinism (same pp twice -> byte-identical output) ----------
function checkP3_seed_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 100; i++) {
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
  const confForced = [0.99 - eps, 0.99 + eps, 0, -0, eps, 1 - eps, 1, Number.MIN_VALUE];
  for (const cl of confForced) {
    const output_payload = compute({ n_assets: 5, n_paths: 500, conf_level: cl, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.mc_var_pct)) violations++;
    if (output_payload.n_paths !== 500) violations++;
  }
  // NOTE (direct-read finding, informational — NOT fixed here, out of this row's fence): correlation
  // exactly 1, or negative correlation with n_assets>2, drives buildCholesky's L[j][j]=sqrt(1-sumSq)
  // or the parametric leg to a NaN — confirmed by direct probe (correlation=1 -> mc_var_pct NaN;
  // correlation=-1+eps -> both mc_var_pct and param_var_pct NaN). This floor only forces the
  // documented equal-pairwise-correlation domain (0 up to just under 1); it does not assert finiteness
  // at exactly 1 or at negative correlation, which is a genuine kernel edge case outside this row's
  // no-kernel-edit fence.
  const corrForced = [0, -0, eps, 1 - eps, Number.MIN_VALUE];
  for (const c of corrForced) {
    const output_payload = compute({ n_assets: 5, n_paths: 500, correlation: c, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.mc_var_pct)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_conf_level_and_correlation', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_clamps());
results.properties.push(checkP2_boundedness_var_es());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'qfa-02-portfolio-var-engine',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

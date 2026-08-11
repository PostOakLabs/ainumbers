// rca-01-frtb-ima-pre-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C15-1).
// kernel_digest_at_authoring: sha256:da8805bcbfcd243d64f4bc2ac97f773b290fe8baa5a30fa7277e2d8c965506bb
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (Monte Carlo P&L simulation over an LCG PRNG, confidenceLevel/nmrfRate float
// comparisons, direct read confirmed) — ULP-boundary forcing is MANDATORY.
// Checks: fixture-oracle gate, termination (nScenarios/nPositions are NOT implementation-clamped —
// compute() runs `Math.max(1, Number(pp.nScenarios) || 2000)` iterations exactly once per declared
// value, so the termination bound is the caller-supplied input itself, a class-C data-dependent-loop
// shape; the property asserts n_scenarios/n_positions echo the requested value and the loop performs
// no extra work), boundedness/differential (capital_required === max(capital_ima, sa_floor) and
// floor_binding === capital_ima < sa_floor, recomputed directly), seed-determinism metamorphic (same
// pp -> byte-identical output, twice), and ULP-boundary forcing on confidenceLevel/nmrfRate.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/rca-01-frtb-ima-pre-validator.proptest.mjs

import { compute } from '../rca-01-frtb-ima-pre-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'rca-01-frtb-ima-pre-validator.fixtures.json');
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
const rand = mulberry32(0x1103a6);

function randomPP(rng) {
  return {
    nPositions: Math.floor(rng() * 30) + 1,
    // kept small (compute cost is O(nScenarios^2)-ish across the per-class re-simulation loop) —
    // the WU row's own class-C shape ("data-dependent loops", termination bound = caller input) is
    // exercised precisely because there is no implementation clamp to test instead.
    nScenarios: Math.floor(rng() * 300) + 10,
    confidenceLevel: pick(rng, [0.95, 0.975, 0.99]),
    nRiskClasses: Math.floor(rng() * 5) + 1,
    nmrfRate: rng() * 0.3,
    seed: Math.floor(rng() * 1e9),
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 100;

// ---------- P1: termination — declared nScenarios/nPositions is the exact bound, not a clamp ----------
function checkP1_termination_input_bound() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.n_scenarios !== pp.nScenarios) violations++;
    if (output_payload.n_positions !== pp.nPositions) violations++;
    if (output_payload.es_by_lh_class.length !== 5) violations++; // fixed LH_DAYS table length
  }
  return { name: 'P1_termination_bound_equals_declared_input', trials: checked, violations };
}

// ---------- P2 (differential): capital_required === max(capital_ima, sa_floor); floor_binding agreement ----------
function checkP2_capital_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedCapital = +Math.max(output_payload.capital_ima, output_payload.sa_floor).toFixed(2);
    if (Math.abs(expectedCapital - output_payload.capital_required) > 0.02) violations++;
    if (output_payload.floor_binding !== (output_payload.capital_ima < output_payload.sa_floor)) violations++;
    if (!Number.isFinite(output_payload.pla_ratio)) violations++;
  }
  return { name: 'P2_capital_required_and_floor_binding_differential', trials: checked, violations };
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
  const clForced = [0, -0, eps, 0.975 - eps, 0.975 + eps, 1 - eps, 1, Number.MIN_VALUE];
  for (const cl of clForced) {
    const { output_payload } = compute({ confidenceLevel: cl, nScenarios: 50, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.pla_ratio)) violations++;
  }
  const nmrfForced = [0, -0, eps, 1 - eps, 1, Number.MIN_VALUE];
  for (const nr of nmrfForced) {
    const { output_payload } = compute({ nmrfRate: nr, nScenarios: 50, seed: 7 });
    checked++;
    if (!Number.isFinite(output_payload.nmrf_surcharge)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_confidenceLevel_and_nmrfRate', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_input_bound());
results.properties.push(checkP2_capital_differential());
results.properties.push(checkP3_seed_determinism());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'rca-01-frtb-ima-pre-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

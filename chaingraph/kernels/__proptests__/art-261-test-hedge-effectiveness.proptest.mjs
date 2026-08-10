// art-261-test-hedge-effectiveness.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:2240e320a2d2880ca48fbe570ff159401593baa97abc367db0c558dc06cca5cd
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (OLS regression sums-of-squares + division, ULP
// -forced below). Checks: fixture-oracle gate, termination (bounded by min(changes array lengths)),
// boundedness (r_squared <= 1, obs count correctly paired), ULP-boundary forcing (empty arrays,
// zero-variance x, denormal changes, single-observation regression skip), and a metamorphic property
// (scaling both change arrays by the same positive constant leaves ols_beta/dollar_offset_ratio
// unchanged — both are scale-invariant ratios).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-261-test-hedge-effectiveness.proptest.mjs

import { compute } from '../art-261-test-hedge-effectiveness.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-261-test-hedge-effectiveness.fixtures.json');
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
const rand = mulberry32(0x261A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 5000;

function randomChangesPair(rng, n) {
  const hedged = [], hedging = [];
  for (let i = 0; i < n; i++) {
    const x = randRange(rng, -1000, 1000);
    hedged.push(x);
    hedging.push(-x * randRange(rng, 0.7, 1.3) + randRange(rng, -20, 20));
  }
  return { hedged, hedging };
}

// ---------- P1: termination — observation_count bounded by min(array lengths) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const nA = Math.floor(randRange(rand, 0, 60));
    const nB = Math.floor(randRange(rand, 0, 60));
    const { hedged } = randomChangesPair(rand, nA);
    const { hedging } = randomChangesPair(rand, nB);
    const output_payload = compute({ method: 'both', hedged_item_changes: hedged, hedging_instrument_changes: hedging });
    checked++;
    if (output_payload.observation_count > Math.min(nA, nB)) violations++;
  }
  return { name: 'P1_termination_obs_bounded_by_min_length', trials: checked, violations };
}

// ---------- P2: boundedness — r_squared <= 1, dollar_offset_ratio finite when defined ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 20));
    const { hedged, hedging } = randomChangesPair(rand, n);
    const output_payload = compute({ method: 'both', hedged_item_changes: hedged, hedging_instrument_changes: hedging });
    checked++;
    if (output_payload.r_squared !== null && output_payload.r_squared > 1.0001) violations++;
    if (output_payload.dollar_offset_ratio !== null && !Number.isFinite(output_payload.dollar_offset_ratio)) violations++;
    if (output_payload.ols_beta !== null && !Number.isFinite(output_payload.ols_beta)) violations++;
  }
  return { name: 'P2_boundedness_rsquared_and_finite_ratios', trials: checked, violations };
}

// ---------- P3: differential — is_effective re-derived from dollar_offset_effective & regression_effective under method='both' ----------
function checkP3_effective_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(randRange(rand, 0, 20));
    const { hedged, hedging } = randomChangesPair(rand, n);
    const output_payload = compute({ method: 'both', hedged_item_changes: hedged, hedging_instrument_changes: hedging });
    checked++;
    let expected;
    if (output_payload.observation_count >= 3) {
      expected = (output_payload.dollar_offset_effective === true) && (output_payload.regression_effective === true);
    } else if (output_payload.observation_count >= 1) {
      expected = output_payload.dollar_offset_effective === true;
    } else {
      expected = false;
    }
    if (output_payload.is_effective !== expected) violations++;
  }
  return { name: 'P3_is_effective_differential', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) ----------
const ULP_BOUNDARY_CASES = [
  { label: 'empty arrays -> no observations', hedged_item_changes: [], hedging_instrument_changes: [] },
  { label: 'single observation -> dollar-offset only, no regression', hedged_item_changes: [100], hedging_instrument_changes: [-95] },
  { label: 'cumulative_hedged exactly zero -> guarded division', hedged_item_changes: [100, -100], hedging_instrument_changes: [-95, 95] },
  { label: 'negative-zero changes', hedged_item_changes: [-0, -0, -0], hedging_instrument_changes: [-0, -0, -0] },
  { label: 'zero-variance x (constant hedged item) -> denom=0 guard', hedged_item_changes: [50, 50, 50, 50], hedging_instrument_changes: [-40, -45, -42, -48] },
  { label: 'denormal changes', hedged_item_changes: [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE], hedging_instrument_changes: [-Number.MIN_VALUE, -Number.MIN_VALUE, -Number.MIN_VALUE] },
  { label: 'ratio exactly at 0.80 dollar-offset boundary', hedged_item_changes: [100], hedging_instrument_changes: [-80] },
  { label: 'ratio exactly at 1.25 dollar-offset boundary', hedged_item_changes: [100], hedging_instrument_changes: [-125] },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute({ method: 'both', ...c });
    const finite = (output_payload.dollar_offset_ratio === null || Number.isFinite(output_payload.dollar_offset_ratio))
      && (output_payload.ols_beta === null || Number.isFinite(output_payload.ols_beta))
      && (output_payload.r_squared === null || Number.isFinite(output_payload.r_squared));
    rows.push({ label: c.label, dollar_offset_ratio: output_payload.dollar_offset_ratio, is_effective: output_payload.is_effective, finite });
  }
  return rows;
}

// ---------- P5: metamorphic — scaling both change arrays by k>0 leaves beta/ratio unchanged (scale-invariant) ----------
function checkP5_scale_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 3 + Math.floor(randRange(rand, 0, 15));
    const { hedged, hedging } = randomChangesPair(rand, n);
    const k = randRange(rand, 0.5, 5);
    const r1 = compute({ method: 'both', hedged_item_changes: hedged, hedging_instrument_changes: hedging });
    const r2 = compute({ method: 'both', hedged_item_changes: hedged.map((v) => v * k), hedging_instrument_changes: hedging.map((v) => v * k) });
    checked++;
    // Tolerance covers the _round4/_round6 rounding compounding through the k-scale (each side rounds
    // independently, so the gap can exceed a single ULP by a small multiple near boundary values).
    if (r1.dollar_offset_ratio !== null && r2.dollar_offset_ratio !== null) {
      if (Math.abs(r1.dollar_offset_ratio - r2.dollar_offset_ratio) > 0.02) violations++;
    }
    if (r1.ols_beta !== null && r2.ols_beta !== null) {
      if (Math.abs(r1.ols_beta - r2.ols_beta) > 0.02) violations++;
    }
    if (r1.r_squared !== null && r2.r_squared !== null) {
      if (Math.abs(r1.r_squared - r2.r_squared) > 0.02) violations++;
    }
  }
  return { name: 'P5_metamorphic_scale_invariance_ratios', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_effective_differential());
results.properties.push(checkP5_scale_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-261-test-hedge-effectiveness',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);

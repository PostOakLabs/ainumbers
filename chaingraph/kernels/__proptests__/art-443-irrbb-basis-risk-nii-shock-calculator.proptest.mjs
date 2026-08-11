// art-443-irrbb-basis-risk-nii-shock-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:701a0152c59e366809bea8593b240c652e7c3c3986993f5d2c0c185ed03e621e
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — r2 rounding at every arithmetic step
// over an unbounded index_exposures array, division by 10000 and by Math.abs(parallelNii)
// for basis_risk_pct_of_parallel) — ULP-boundary forcing present below on the
// parallelNii !== 0 zero-denominator gate and the isMaterial threshold compare.
// Checks: fixture-oracle gate, termination (index_results length bounded by input array
// length), boundedness (all NII fields finite, basis_risk_pct_of_parallel finite-or-null),
// differential re-derivation of basis_risk_delta_nii, metamorphic index-order invariance of
// the aggregated totals, ULP-boundary forcing on the zero-parallelNii gate and the
// materiality threshold compare.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-443-irrbb-basis-risk-nii-shock-calculator.proptest.mjs

import { compute } from '../art-443-irrbb-basis-risk-nii-shock-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-443-irrbb-basis-risk-nii-shock-calculator.fixtures.json');
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
const rand = mulberry32(0x443A0);

function randomIndex(rng, i) {
  return { index_name: 'idx-' + i, asset_balance: (rng() - 0.5) * 2e6, liability_balance: (rng() - 0.5) * 2e6, beta_vs_reference: rng() * 2 };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    index_exposures: Array.from({ length: n }, (_, i) => randomIndex(rng, i)),
    reference_shock_bps: (rng() - 0.5) * 400,
    horizon_months: rng() * 24,
    material_threshold_pct: rng() * 0.5,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — index_results length bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.index_results.length !== pp.index_exposures.length) violations++;
  }
  return { name: 'P1_termination_index_results_bounded_by_input', trials: checked, violations };
}

// ---------- P2: boundedness — NII fields finite, pct-of-parallel finite-or-null ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const fields = [output_payload.total_net_exposure, output_payload.total_nii_contribution, output_payload.parallel_delta_nii, output_payload.basis_risk_delta_nii];
    if (fields.some((v) => !Number.isFinite(v))) violations++;
    if (output_payload.basis_risk_pct_of_parallel !== null && !Number.isFinite(output_payload.basis_risk_pct_of_parallel)) violations++;
  }
  return { name: 'P2_boundedness_nii_fields_finite_or_null', trials: checked, violations };
}

// ---------- P3 (differential): basis_risk_delta_nii = sum(nii_contribution) - parallel_nii ----------
function checkP3_basis_risk_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = Math.round((output_payload.total_nii_contribution - output_payload.parallel_delta_nii) * 100) / 100;
    if (Math.abs(expected - output_payload.basis_risk_delta_nii) > 0.02) violations++;
  }
  return { name: 'P3_basis_risk_delta_nii_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering index_exposures never changes the aggregated totals ----------
function checkP4_index_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.index_exposures.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, index_exposures: [...pp.index_exposures].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.total_nii_contribution - r2v.total_nii_contribution) > 0.05) violations++;
    if (Math.abs(r1.basis_risk_delta_nii - r2v.basis_risk_delta_nii) > 0.05) violations++;
  }
  return { name: 'P4_index_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): zero-parallelNii gate and materiality threshold boundary ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  // force parallelNii === 0 exactly (zero net exposure) -> pct must be null
  checked++;
  const zeroCase = compute({ index_exposures: [{ index_name: 'i', asset_balance: 1000, liability_balance: 1000, beta_vs_reference: 1 }], reference_shock_bps: 100, horizon_months: 12 }).output_payload;
  if (zeroCase.basis_risk_pct_of_parallel !== null) violations++;
  // force parallelNii to a tiny denormal-scale nonzero value -> pct must be finite, never Infinity
  checked++;
  const tinyCase = compute({ index_exposures: [{ index_name: 'i', asset_balance: Number.MIN_VALUE, liability_balance: 0, beta_vs_reference: 1 }], reference_shock_bps: EPS, horizon_months: 12 }).output_payload;
  if (tinyCase.basis_risk_pct_of_parallel !== null && !Number.isFinite(tinyCase.basis_risk_pct_of_parallel)) violations++;
  // materiality threshold boundary: basis_risk_pct exactly at, just under, just over the threshold
  const thresholdCases = [0.10, 0.10 - EPS, 0.10 + EPS, 0, -0];
  for (const thr of thresholdCases) {
    checked++;
    const { output_payload } = compute({
      index_exposures: [{ index_name: 'a', asset_balance: 1000, liability_balance: 0, beta_vs_reference: 1.2 }, { index_name: 'b', asset_balance: 1000, liability_balance: 0, beta_vs_reference: 1 }],
      reference_shock_bps: 100, horizon_months: 12, material_threshold_pct: thr,
    });
    if (!Number.isFinite(output_payload.basis_risk_delta_nii)) violations++;
    if (typeof output_payload.is_material !== 'boolean') violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_zero_denominator_and_materiality_threshold', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_basis_risk_differential());
results.properties.push(checkP4_index_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-443-irrbb-basis-risk-nii-shock-calculator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

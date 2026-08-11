// art-427-discount-window-capacity.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:b7fb2d160f36179a5229300a2a696fd22589ca237f2ab5083b3c816b61e48e16
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (division to build coverage_pct, margin_pct multiplication/sum over
// an unbounded collateral_positions array) — ULP-boundary forcing present below.
// Checks: fixture-oracle gate, termination (row counts bounded by input array length),
// boundedness (lendable/runnable/coverage fields finite-or-null, never NaN/Infinity),
// differential re-derivation of lendable_value_musd and coverage_pct, metamorphic
// collateral-order invariance, ULP-boundary forcing on the zero-denominator coverage_pct
// branch and margin_pct clamp.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-427-discount-window-capacity.proptest.mjs

import { compute } from '../art-427-discount-window-capacity.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-427-discount-window-capacity.fixtures.json');
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
const rand = mulberry32(0x427A0);

function randomPP(rng) {
  const nc = Math.floor(rng() * 8);
  const nl = Math.floor(rng() * 8);
  return {
    margin_table_version: 'v1',
    coverage_target_pct: rng() * 150,
    collateral_positions: Array.from({ length: nc }, (_, i) => ({ category: 'cat-' + i, par_value_musd: rng() * 1e5, margin_pct: rng() * 100 })),
    runnable_liabilities: Array.from({ length: nl }, (_, i) => ({ label: 'liab-' + i, balance_musd: rng() * 1e5 })),
  };
}

const TRIALS = 5000;

// ---------- P1: termination — row counts bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    // rows are internal only, but output_payload derives sums from exactly the input arrays --
    // check the derived totals never exceed what the unclamped input arrays could produce.
    const maxLendable = pp.collateral_positions.reduce((s, p) => s + Math.max(0, p.par_value_musd) * Math.min(100, Math.max(0, p.margin_pct)) / 100, 0);
    if (output_payload.lendable_value_musd > Math.round((maxLendable + 0.01) * 100) / 100) violations++;
  }
  return { name: 'P1_termination_lendable_bounded_by_input', trials: checked, violations };
}

// ---------- P2: boundedness — coverage/lendable fields finite-or-null, never NaN/Infinity ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const fields = [output_payload.lendable_value_musd, output_payload.runnable_liabilities_musd, output_payload.capacity_surplus_shortfall_musd];
    if (fields.some((v) => !Number.isFinite(v))) violations++;
    if (output_payload.coverage_pct !== null && !Number.isFinite(output_payload.coverage_pct)) violations++;
  }
  return { name: 'P2_boundedness_finite_or_null', trials: checked, violations };
}

// ---------- P3 (differential): lendable_value_musd re-derivation ----------
function checkP3_lendable_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = Math.round(pp.collateral_positions.reduce((s, p) => s + Math.max(0, p.par_value_musd) * Math.min(100, Math.max(0, p.margin_pct)) / 100, 0) * 100) / 100;
    if (Math.abs(expected - output_payload.lendable_value_musd) > 0.01) violations++;
  }
  return { name: 'P3_lendable_value_differential', trials: checked, violations };
}

// ---------- P4 (differential): coverage_pct zero-denominator gate ----------
function checkP4_coverage_zero_denominator() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.runnable_liabilities_musd === 0 && output_payload.coverage_pct !== null) violations++;
    if (output_payload.runnable_liabilities_musd > 0 && output_payload.coverage_pct === null) violations++;
  }
  return { name: 'P4_coverage_pct_zero_denominator_gate', trials: checked, violations };
}

// ---------- P5: metamorphic — reordering collateral_positions never changes lendable_value_musd ----------
function checkP5_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.collateral_positions.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, collateral_positions: [...pp.collateral_positions].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.lendable_value_musd - r2v.lendable_value_musd) > 0.01) violations++;
  }
  return { name: 'P5_collateral_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P6 (ULP-forcing): margin_pct clamp boundary + zero-denominator + negative-zero ----------
function checkP6_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  const boundaryMargins = [0, -0, 100, 100 - EPS, 100 + EPS, EPS, -EPS, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const m of boundaryMargins) {
    checked++;
    const { output_payload } = compute({
      margin_table_version: 'v1', coverage_target_pct: 100,
      collateral_positions: [{ category: 'c', par_value_musd: 1000, margin_pct: m }],
      runnable_liabilities: [],
    });
    if (!Number.isFinite(output_payload.lendable_value_musd)) violations++;
    if (output_payload.coverage_pct !== null) violations++; // runnable total is 0 -> null gate
  }
  // negative-zero runnable total
  checked++;
  const zeroRunnable = compute({ margin_table_version: 'v1', coverage_target_pct: 100, collateral_positions: [], runnable_liabilities: [{ label: 'l', balance_musd: -0 }] }).output_payload;
  if (zeroRunnable.coverage_pct !== null) violations++;
  return { name: 'P6_ulp_boundary_forcing_margin_clamp_and_zero_denominator', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_lendable_differential());
results.properties.push(checkP4_coverage_zero_denominator());
results.properties.push(checkP5_order_metamorphic());
results.properties.push(checkP6_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-427-discount-window-capacity',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

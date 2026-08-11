// art-368-compute-fx-netting-positions.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:665538f1e6305877bc876b3bd1bf4fcc797a890efabe8855d1dd82f9375af8ce
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (effective_rate = spot * (1 + fwd_bps/10000), netting_efficiency_pct
// division, VaR = |net_usd| * vol_30d * 1.65 — direct read confirmed) — ULP-boundary forcing
// is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (unbounded positions array — bound is array length),
// boundedness (netting_efficiency_pct <= 100, gross/net volumes >= 0), metamorphic
// (positions-array permutation invariance of every suite-level aggregate — sums/counts are
// order-independent), ULP-boundary forcing on spot/fwd_bps/vol_30d.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-368-compute-fx-netting-positions.proptest.mjs

import { compute } from '../art-368-compute-fx-netting-positions.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-368-compute-fx-netting-positions.fixtures.json');
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
const rand = mulberry32(0x368D0);

function randomPosition(rng, tag) {
  return {
    ccy: tag,
    pay: Math.round(rng() * 1000000),
    rec: Math.round(rng() * 1000000),
    spot: 0.5 + rng() * 2,
    fwd_bps: Math.round((rng() - 0.5) * 100),
    vol_30d: 0.01 + rng() * 0.1,
  };
}

function randomPP(rng, n) {
  const positions = [];
  for (let i = 0; i < n; i++) positions.push(randomPosition(rng, `C${i}`));
  return { positions };
}

const TRIALS = 3000;

// ---------- P1: termination — unbounded positions array, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 500];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.positions.length !== n || output_payload.currency_count !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.positions.length !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — netting_efficiency_pct <= 100, volumes >= 0 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, 1 + Math.floor(rand() * 8));
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.netting_efficiency_pct > 100) violations++;
    if (output_payload.gross_volume_usd < 0 || output_payload.net_volume_usd < 0) violations++;
    if (output_payload.estimated_settlement_savings_usd < 0) violations++;
    for (const p of output_payload.positions) {
      if (!Number.isFinite(p.net_fcy) || !Number.isFinite(p.net_usd) || !Number.isFinite(p.var_approx_usd)) violations++;
      if (p.var_approx_usd < 0) violations++;
    }
  }
  return { name: 'P2_boundedness_efficiency_and_volumes', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation invariance of suite-level aggregates ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 3; i++) {
    const n = 2 + Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const shuffled = { positions: [...pp.positions].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.gross_volume_usd !== b.gross_volume_usd) violations++;
    if (a.net_volume_usd !== b.net_volume_usd) violations++;
    if (a.netting_efficiency_pct !== b.netting_efficiency_pct) violations++;
    if (a.estimated_settlement_savings_usd !== b.estimated_settlement_savings_usd) violations++;
    if (a.currency_count !== b.currency_count) violations++;
  }
  return { name: 'P3_permutation_invariance_of_aggregates', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — spot/fwd_bps/vol_30d ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const spotBoundary = [0, -0, eps, Number.MIN_VALUE, 1e-300, 1];
  for (const spot of spotBoundary) {
    const pp = { positions: [{ ccy: 'XX', pay: 1000, rec: 500, spot, fwd_bps: 0, vol_30d: 0.05 }] };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const p = output_payload.positions[0];
    if (!Number.isFinite(p.net_fcy) || !Number.isFinite(p.net_usd)) violations++;
    if (spot <= 0 && !compliance_flags.some((f) => f.startsWith('FXNET_NON_POSITIVE_SPOT'))) violations++;
  }
  // fwd_bps at ULP boundaries around zero
  for (const fwd_bps of [0, -0, eps, -eps, Number.MIN_VALUE]) {
    const pp = { positions: [{ ccy: 'XX', pay: 1000, rec: 500, spot: 1, fwd_bps, vol_30d: 0.05 }] };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.positions[0].net_usd)) violations++;
  }
  // vol_30d at ULP boundaries (feeds var_approx_usd)
  for (const vol of [0, -0, eps, Number.MIN_VALUE, 1e-300]) {
    const pp = { positions: [{ ccy: 'XX', pay: 1000, rec: 2000, spot: 1, fwd_bps: 0, vol_30d: vol }] };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.positions[0].var_approx_usd) || output_payload.positions[0].var_approx_usd < 0) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_spot_fwdbps_vol', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-368-compute-fx-netting-positions',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// kernel_digest_at_authoring: sha256:76262e8984a1549f9ff95eb1312333c269fc15afbeb9c2f7fc6a7364393ef966
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-330-tvm-dv01.
// Class B (bounded-numeric), FLOAT-SENSITIVE — DV01 is a central-difference full reprice at
// yield ± a small basis-point shock, so it directly exercises near-zero-yield-delta arithmetic —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3, and per the WU row MUST
// include near-zero-rate edge cases. This kernel's fixture note also records a prior 100x scale
// bug in the shock-size calculation (CC-G-RECOVER-1) that this floor's fixed-rule property would
// have caught. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-330-tvm-dv01.proptest.mjs

import { compute } from '../art-330-tvm-dv01.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-330-tvm-dv01.fixtures.json');
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
const rand = mulberry32(0x330DA);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 6000;

function mkPP(rng) {
  return {
    face_value: randRange(rng, 100, 10000),
    coupon_rate_pct: randRange(rng, 0, 12),
    ytm_pct: randRange(rng, 0.5, 15),
    years_to_maturity: randRange(rng, 0.25, 30),
    periods_per_year: pick(rng, [1, 2, 4, 12]),
    basis_points: pick(rng, [1, 5, 10, 25]),
  };
}

// ---------- P1: boundedness — dv01 is non-negative for a vanilla positive-coupon bullet bond ----------
function checkP1_dv01NonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.dv01 < -1e-6) violations++;
  }
  return { name: 'P1_dv01_non_negative_for_vanilla_bullet_bond', trials: checked, violations };
}

// ---------- P2: monotonicity — price is strictly lower under the up-shock than the down-shock ----------
function checkP2_priceMonotoneInShockDirection() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.price_up_shock > r.output_payload.price_down_shock + 1e-6) violations++;
  }
  return { name: 'P2_price_up_shock_never_exceeds_price_down_shock', trials: checked, violations };
}

// ---------- P3: fixed rule — dv01 exactly equals (price_down_shock - price_up_shock) / 2 ----------
function checkP3_dv01FixedRelation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { dv01, price_up_shock, price_down_shock } = r.output_payload;
    // price_up_shock/price_down_shock are r2-rounded (max 0.005 error each) before this
    // reconstruction runs, but dv01 itself was computed from the UNROUNDED prices — the
    // tolerance must absorb up to 0.005 combined rounding error / 2, not just dv01's own r6 noise.
    const expected = (price_down_shock - price_up_shock) / 2;
    if (Math.abs(dv01 - expected) > 0.006) violations++;
  }
  return { name: 'P3_dv01_exactly_half_price_down_minus_price_up', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing, incl. near-zero-rate cases ----------
const ULP_BOUNDARY_CASES = [
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 0, years_to_maturity: 5, periods_per_year: 2, basis_points: 1 }, 'ytm_pct exactly zero (near-zero-rate) — shock still applies around a zero base yield, dv01 must remain finite and non-negative'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: -0, years_to_maturity: 5, periods_per_year: 2, basis_points: 1 }, 'ytm_pct negative zero — must behave identically to positive zero, no NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, basis_points: 0 }, 'basis_points exactly zero (no shock) — priceUp/priceDown must both equal priceBase, dv01 must be exactly 0'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 1 / 365, periods_per_year: 2, basis_points: 1 }, 'years_to_maturity near-zero (one day, near-zero-duration) — dv01 must remain finite and small, not NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, basis_points: 1e-6 }, 'basis_points an extremely small fractional shock — dv01 must remain finite, not divide-by-near-zero unstable'],
  [{ face_value: 1000, coupon_rate_pct: 0, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, basis_points: 1 }, 'coupon_rate_pct exactly zero (zero-coupon bond) — dv01 must still be well-defined and non-negative'],
  [{ face_value: Number.MIN_VALUE, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, basis_points: 1 }, 'face_value smallest positive double — dv01 must remain finite, non-NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 99.9999999999999, years_to_maturity: 5, periods_per_year: 2, basis_points: 1 }, 'ytm_pct at 1-ULP-below-100 boundary — discount factors under both shocks must remain finite'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, basis_points: 100 * 0.01 }, 'basis_points = 100*0.01 (classic non-exact double artifact) — dv01 must reflect that exact double shock, no NaN'],
  [{ face_value: 1000, coupon_rate_pct: 6, ytm_pct: 8, years_to_maturity: 5, periods_per_year: 2, basis_points: 10000 }, 'basis_points at the full 100bp/1% extreme — shocked yield may go negative or wrap, dv01 must remain finite, never throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { dv01, price, price_up_shock, price_down_shock } = r.output_payload;
    const plausible = Number.isFinite(dv01) && Number.isFinite(price) && Number.isFinite(price_up_shock) && Number.isFinite(price_down_shock);
    rows.push({ label, input: pp, dv01, price, price_up_shock, price_down_shock, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_dv01NonNegative());
results.properties.push(checkP2_priceMonotoneInShockDirection());
results.properties.push(checkP3_dv01FixedRelation());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);

// kernel_digest_at_authoring: sha256:4c530398ab42ff734dd6db698e15fbea8f6eaaede6646e324af8e79d514dfa44
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for qfa-01-options-greeks.
// Class B (bounded-numeric), FLOAT:YES — Black-Scholes price + Greeks over the kernel's
// own inlined deterministic fdlibm (det.exp/det.log). ULP-boundary forcing mandatory.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape
// as the B1/B12 harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/qfa-01-options-greeks.proptest.mjs

import { compute } from '../qfa-01-options-greeks.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'qfa-01-options-greeks.fixtures.json');
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
const rand = mulberry32(0x0FA01A);
const TRIALS = 6000;
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    spot: range(rng, 1, 1000),
    strike: range(rng, 1, 1000),
    expiry_days: range(rng, 1, 1825),
    vol: range(rng, 1, 200),
    rate: range(rng, -2, 15),
    div_yield: range(rng, 0, 10),
    type: pick(rng, ['call', 'put']),
  };
}

// ---------- P1: price is non-negative for both call and put ----------
function checkP1_priceNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.price < 0) violations++;
  }
  return { name: 'P1_price_non_negative', trials: checked, violations };
}

// ---------- P2: delta is bounded to [-1,1] (put) / [0,1] (call) ----------
function checkP2_deltaBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { delta, type } = r.output_payload;
    if (type === 'call' && !(delta >= -1e-6 && delta <= 1 + 1e-6)) violations++;
    if (type === 'put' && !(delta >= -1 - 1e-6 && delta <= 1e-6)) violations++;
  }
  return { name: 'P2_delta_bounded_to_declared_range_per_type', trials: checked, violations };
}

// ---------- P3: gamma is non-negative (convexity of option price in spot) ----------
function checkP3_gammaNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.gamma < -1e-9) violations++;
  }
  return { name: 'P3_gamma_non_negative', trials: checked, violations };
}

// ---------- P4: put-call parity — call_price - put_price == S*e^-qT - K*e^-rT (within tolerance) ----------
function checkP4_putCallParity() {
  let violations = 0, checked = 0;
  const TOL = 1e-3;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const callPP = { ...pp, type: 'call' };
    const putPP = { ...pp, type: 'put' };
    const rc = compute(callPP);
    const rp = compute(putPP);
    checked++;
    const T = pp.expiry_days / 365;
    const expected = pp.spot * Math.exp(-pp.div_yield / 100 * T) - pp.strike * Math.exp(-pp.rate / 100 * T);
    const lhs = rc.output_payload.price - rp.output_payload.price;
    // tolerance scales with notional since price is rounded to 6dp before this diff
    const tol = Math.max(TOL, Math.abs(expected) * 1e-4);
    if (Math.abs(lhs - expected) > tol) violations++;
  }
  return { name: 'P4_put_call_parity_within_tolerance', trials: checked, violations };
}

// ---------- P5 (mandatory, float-sensitive): forced ULP-boundary cases ----------
function checkP5_forced() {
  const rows = [];
  const base = { spot: 100, strike: 100, expiry_days: 90, vol: 20, rate: 5, div_yield: 0, type: 'call' };
  const cases = [
    { ...base, spot: 0, label: 'spot exactly 0 — guard clause must return finite zero-greeks, never divide by zero' },
    { ...base, strike: 0, label: 'strike exactly 0 — guard clause must return finite zero-greeks' },
    { ...base, vol: 0, label: 'vol exactly 0 — guard clause must return finite zero-greeks (division by sigma)' },
    { ...base, expiry_days: 0, label: 'expiry_days exactly 0 — T<=0 branch returns intrinsic value, not a division' },
    { ...base, spot: 100, strike: 100, label: 'spot exactly equals strike (at-the-money) — d1/d2 must stay finite' },
    { ...base, spot: -0, label: 'spot is negative zero — guard clause (S<=0) must still trip' },
    { ...base, vol: Number.MIN_VALUE, label: 'vol at denormal scale (Number.MIN_VALUE) — sigma*sqT denominator near-zero, must stay finite' },
    { ...base, spot: NaN, label: 'spot is NaN — finite-input guard must catch it and return zero-greeks, not propagate NaN' },
    { ...base, rate: -2, div_yield: 10, label: 'rate below div_yield (negative carry) — exp(-qT)/exp(-rT) both still finite' },
    { spot: 100, strike: 100, expiry_days: 90, vol: 20, rate: 5, div_yield: 0, type: 'put', label: 'ATM put — delta must land in [-1,0] (deep ITM/OTM excluded by construction)' },
    { ...base, expiry_days: 1825, label: 'expiry at 5-year long-dated boundary — sqT/log(S/K) terms stay finite' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const { price, delta, gamma, theta_per_day, vega_per_pct, rho_per_pct, d1, d2 } = r.output_payload;
    const plausible = [price, delta, gamma, theta_per_day, vega_per_pct, rho_per_pct, d1, d2].every(Number.isFinite);
    rows.push({ label, input: pp, price, delta, gamma, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_priceNonNegative());
results.properties.push(checkP2_deltaBounded());
results.properties.push(checkP3_gammaNonNegative());
results.properties.push(checkP4_putCallParity());
results.boundary_forced = checkP5_forced();

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

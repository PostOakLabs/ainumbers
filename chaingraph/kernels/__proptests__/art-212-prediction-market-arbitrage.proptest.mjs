// kernel_digest_at_authoring: sha256:9de8985132fa0e2c236ff11a4867d08f38e2ae3efdc27e75240b0c1078bb7f49
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-212-prediction-market-arbitrage.
// Class B (bounded cross-venue arbitrage calculator). float-sensitive: yes -- venue-specific
// fee formulas (ceil/round to cent), a guarded division for contract count, and price clamping
// into (0, payout) are all raw floating-point arithmetic. ULP-boundary forcing is mandatory per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-212-prediction-market-arbitrage.proptest.mjs

import { compute } from '../art-212-prediction-market-arbitrage.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-212-prediction-market-arbitrage.fixtures.json');
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
const rand = mulberry32(0x21201);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 8000;
const VENUES = ['polymarket', 'kalshi', 'cme_event', 'robinhood', 'sx_bet'];

function mkPP(rng) {
  return {
    venue_a: pick(rng, VENUES),
    venue_b: pick(rng, VENUES),
    payout: randRange(rng, 0.5, 5),
    stake_total: randRange(rng, 1, 100000),
    yes_price_a: randRange(rng, -1, 6),
    no_price_b: randRange(rng, -1, 6),
  };
}

// ---------- P1: boundedness -- clamped prices land in (0, payout); all fees non-negative ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.yes_price_a <= 0 || r.yes_price_a >= r.payout) violations++;
    if (r.no_price_b <= 0 || r.no_price_b >= r.payout) violations++;
    if (r.fee_a < 0 || r.fee_b < 0 || r.total_fees < 0) violations++;
    if (r.stake_total < 1) violations++;
    if (r.capital_deployed < 0 || r.k_contracts < 0) violations++;
  }
  return { name: 'P1_boundedness_clamped_prices_and_nonneg_fees', trials: checked, violations };
}

// ---------- P2: arb_exists agrees with the raw gross_spread sign ----------
function checkP2_arbAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expArb = r.gross_spread > 0;
    if (r.arb_exists !== expArb) violations++;
  }
  return { name: 'P2_arb_exists_matches_gross_spread_sign', trials: checked, violations };
}

// ---------- P3: identity -- net_profit reconstructs from gross_profit and total_fees within cent-rounding tolerance ----------
function checkP3_netProfitIdentity() {
  let violations = 0, checked = 0;
  const TOL = 0.02;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expNet = Math.round((r.gross_profit - r.total_fees) * 100) / 100;
    if (Math.abs(r.net_profit - expNet) > TOL) violations++;
    // Leg fees are summed in integer micro-dollars (PREDMKT-FEE-INPLACE-FIX-1), so the identity is exact to $0.000001.
    if (Math.round(r.total_fees * 1e6) !== Math.round(r.fee_a * 1e6) + Math.round(r.fee_b * 1e6)) violations++;
  }
  return { name: 'P3_net_profit_reconstructs_from_gross_and_fees', trials: checked, violations };
}

// ---------- P4: metamorphic -- scaling stake_total by k>0 scales capital_deployed/gross_profit by k, within tolerance ----------
function checkP4_scaleInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = mkPP(rand);
    const k = randRange(rand, 1.5, 8);
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, stake_total: pp.stake_total * k }).output_payload;
    checked++;
    const tol = Math.max(0.05, Math.abs(r1.capital_deployed * k) * 1e-4);
    if (Math.abs(r2.capital_deployed - r1.capital_deployed * k) > tol) violations++;
  }
  return { name: 'P4_metamorphic_stake_scale_linearity_on_capital_deployed', trials: checked, violations };
}

// ---------- P5: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ venue_a: 'polymarket', venue_b: 'kalshi', yes_price_a: 0.5, no_price_b: 0.5, payout: 1 }, 'gross_spread exactly zero (cost_per_unit == payout) -- arb_exists must be false (> is strict)'],
  [{ venue_a: 'polymarket', venue_b: 'kalshi', yes_price_a: 0.5, no_price_b: 0.5 - Number.EPSILON, payout: 1 }, 'gross_spread 1 ULP positive -- arb_exists must flip true'],
  [{ payout: 0 }, 'zero payout -- must clamp to the 0.01 floor, not divide by zero'],
  [{ payout: -0 }, 'negative-zero payout -- must clamp to the 0.01 floor like zero'],
  [{ stake_total: 0 }, 'zero stake_total -- must clamp to the 1 floor'],
  [{ yes_price_a: Number.MIN_VALUE, no_price_b: Number.MIN_VALUE, payout: 1 }, 'denormal prices -- must clamp into (0, payout), stay finite'],
  [{ yes_price_a: NaN, no_price_b: 0.5, payout: 1 }, 'NaN yes_price_a -- safeNum must substitute the default 0.45'],
  [{ venue_a: 'kalshi', venue_b: 'kalshi', yes_price_a: 0.3, no_price_b: 0.3, payout: 1 }, 'same-venue arb -- SAME_VENUE flag path, must not throw'],
  [{ yes_price_a: 1e10, no_price_b: 0.5, payout: 1 }, 'wildly out-of-range price -- must clamp to payout*0.9999, stay finite'],
];

function checkP5_forced() {
  const rows = [];
  for (const [ppPartial, label] of ULP_BOUNDARY_CASES) {
    const pp = { venue_a: 'polymarket', venue_b: 'kalshi', yes_price_a: 0.45, no_price_b: 0.5, payout: 1, stake_total: 1000, ...ppPartial };
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.gross_spread) && Number.isFinite(r.net_profit) && Number.isFinite(r.total_fees)
      && Number.isFinite(r.k_contracts) && Number.isFinite(r.capital_deployed);
    rows.push({ label, pp, gross_spread: r.gross_spread, arb_exists: r.arb_exists, net_profit: r.net_profit, plausible: finite });
  }
  return rows;
}

// ---------- P6 (PREDMKT-FEE-INPLACE-FIX-1): with a whole contract count, the Kalshi leg equals the exact integer ceil ----------
// stake_total = n * cost makes k_contracts = n; fee_cents = ceil(7 * n * pc * (100 - pc) / 10000).
function checkP6_kalshiExactCeil() {
  let violations = 0, checked = 0;
  for (let n = 1; n <= 300; n++) {
    for (let pc = 1; pc <= 99; pc++) {
      const r = compute({ venue_a: 'kalshi', venue_b: 'cme_event', yes_price_a: pc / 100, no_price_b: 0.5, payout: 1, stake_total: n * (pc / 100 + 0.5) }).output_payload;
      if (r.k_contracts !== n) continue;
      checked++;
      const exact = Math.floor((7 * n * pc * (100 - pc) + 9999) / 10000);
      if (Math.round(r.fee_a * 100) !== exact) violations++;
    }
  }
  return { name: 'P6_kalshi_leg_exact_integer_ceil_whole_k', trials: checked, violations };
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_arbAgreement());
results.properties.push(checkP3_netProfitIdentity());
results.properties.push(checkP4_scaleInvariance());
results.properties.push(checkP6_kalshiExactCeil());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-212-prediction-market-arbitrage',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);

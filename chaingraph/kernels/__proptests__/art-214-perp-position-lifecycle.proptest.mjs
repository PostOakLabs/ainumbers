// kernel_digest_at_authoring: sha256:aa963eb24ee88e725b08bbaaf443a0f756a8d42eb469f9c1fe1e68ef75dc4cf6
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-214-perp-position-lifecycle.
// Class B (bounded-numeric), FLOAT-SENSITIVE (fees, funding, and realized-PnL math are
// continuous arithmetic with round2/round6 rounding at every step) — ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32
// PRNG + explicit boundary arrays), same shape as B1-B5's float harnesses. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-214-perp-position-lifecycle.proptest.mjs

import { compute } from '../art-214-perp-position-lifecycle.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-214-perp-position-lifecycle.fixtures.json');
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
const rand = mulberry32(0x2140A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng, overrides = {}) {
  return {
    venue: pick(rng, ['hyperliquid', 'dydx_v4', 'binance']),
    side: 'long',
    entry_price: randRange(rng, 0.01, 200000),
    exit_price: randRange(rng, 0.01, 200000),
    position_size: randRange(rng, 0.000001, 100),
    leverage: randRange(rng, 1, 500),
    funding_rate_per_interval: randRange(rng, -0.01, 0.01),
    n_intervals: Math.floor(randRange(rng, 0, 2000)),
    ...overrides,
  };
}

// ---------- P1: monotone — total_net_pnl moves favorably as exit_price moves in the position's favorable direction ----------
function checkP1_monotonePnl() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const side = pick(rand, ['long', 'short']);
    const base = mkPP(rand, { side, exit_price: randRange(rand, 100, 100000) });
    const bumped = side === 'long'
      ? { ...base, exit_price: base.exit_price * 1.01 }
      : { ...base, exit_price: base.exit_price * 0.99 };
    const rBase = compute(base);
    const rBump = compute(bumped);
    checked++;
    if (rBump.output_payload.total_net_pnl < rBase.output_payload.total_net_pnl - 1e-6) violations++;
  }
  return { name: 'P1_monotone_total_net_pnl_favorable_with_exit_price', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — LIQUIDATION_RISK flag matches the documented mid-price rule exactly ----------
function checkP2_liqFlagAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { side, entry_price, exit_price, liq_price } = r.output_payload;
    const mid = (entry_price + exit_price) / 2;
    const expected = side === 'long' ? mid <= liq_price : mid >= liq_price;
    const flagged = r.compliance_flags.includes('LIQUIDATION_RISK');
    if (flagged !== expected) violations++;
  }
  return { name: 'P2_liquidation_risk_flag_matches_mid_price_rule', trials: checked, violations };
}

// ---------- P3: round-trip identity — margin_returned equals round2(max(0, initial_margin + total_net_pnl)) exactly ----------
function checkP3_marginReturnedIdentity() {
  let violations = 0, checked = 0;
  const round2 = (v) => (isFinite(v) ? Math.round(v * 100) / 100 : 0);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { initial_margin, total_net_pnl, margin_returned } = r.output_payload;
    const expected = round2(Math.max(0, initial_margin + total_net_pnl));
    if (Math.abs(margin_returned - expected) > 1e-6) violations++;
  }
  return { name: 'P3_margin_returned_matches_round2_identity', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ entry_price: 0.01, exit_price: 0.01, position_size: 0.000001, leverage: 1 }, 'all inputs at documented clamp minimums'],
  [{ entry_price: 100, exit_price: 100, position_size: 1 }, 'entry equals exit exactly — price_delta must be exactly 0, not float noise'],
  [{ entry_price: 100, exit_price: 100 + Number.EPSILON, position_size: 1 }, 'exit_price 1 epsilon above entry — price_delta must not silently vanish under round6'],
  [{ funding_rate_per_interval: 0.1 * 3 / 100 }, 'funding_rate = (0.1*3)/100 (non-exact double) — total_funding_impact must remain finite'],
  [{ funding_rate_per_interval: 0, n_intervals: 0 }, 'zero funding rate and zero intervals — total_funding_impact must be exactly 0'],
  [{ n_intervals: 720 }, 'n_intervals exactly at LONG_HOLDING_PERIOD boundary (720) — must NOT flag'],
  [{ n_intervals: 721 }, 'n_intervals 1 above LONG_HOLDING_PERIOD boundary — MUST flag'],
  [{ leverage: 10 }, 'leverage exactly at HIGH_LEVERAGE boundary (10) — must NOT flag'],
  [{ leverage: 10.0001 }, 'leverage just above HIGH_LEVERAGE boundary (10.0001, distinguishable at this scale) — MUST flag'],
  [{ entry_price: 100, exit_price: 100, position_size: (1 / 3) * 3 }, 'position_size = (1/3)*3 rounding artifact — realized_pnl_gross must stay finite, not NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const nums = [op.notional, op.initial_margin, op.total_fees, op.realized_pnl_net, op.total_funding_impact, op.total_net_pnl, op.margin_returned];
    const finite = nums.every(Number.isFinite);
    rows.push({ label, overrides, total_net_pnl: op.total_net_pnl, flags: r.compliance_flags, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonePnl());
results.properties.push(checkP2_liqFlagAgreement());
results.properties.push(checkP3_marginReturnedIdentity());
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

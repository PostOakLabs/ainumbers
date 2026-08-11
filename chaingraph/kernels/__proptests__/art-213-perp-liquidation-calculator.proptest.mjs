// kernel_digest_at_authoring: sha256:2fccd34d45ee83dbb10844e720e1c4469b6f63bec1243d60757849f139768803
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-213-perp-liquidation-calculator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (margin/liquidation math is continuous
// arithmetic over leverage, entry/mark price, position size, all round6/round4-rounded) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as B1-B5's float
// harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-213-perp-liquidation-calculator.proptest.mjs

import { compute } from '../art-213-perp-liquidation-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-213-perp-liquidation-calculator.fixtures.json');
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
const rand = mulberry32(0x2130A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const VENUES = ['hyperliquid', 'dydx_v4', 'binance', 'gmx', 'aster'];

function mkPP(rng, overrides = {}) {
  return {
    venue: pick(rng, VENUES),
    side: 'long',
    mode: 'isolated',
    leverage: randRange(rng, 1, 500),
    entry_price: randRange(rng, 0.01, 200000),
    position_size: randRange(rng, 0.000001, 100),
    mark_price: randRange(rng, 0.01, 200000),
    ...overrides,
  };
}

// ---------- P1: monotone — initial_margin is nonincreasing as leverage increases (fixed venue/entry/size) ----------
function checkP1_monotoneMargin() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, leverage: Math.min(base.leverage, 250) };
    const hi = { ...base, leverage: Math.max(lo.leverage + 1, 251) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.initial_margin > rLo.output_payload.initial_margin + 1e-6) violations++;
  }
  return { name: 'P1_monotone_initial_margin_nonincreasing_with_leverage', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — health matches the documented buffer_pct rule exactly ----------
function checkP2_healthTierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { buffer_pct, health } = r.output_payload;
    const expected = buffer_pct > 100 ? 'GREEN' : buffer_pct > 0 ? 'AMBER' : 'RED';
    if (health !== expected) violations++;
  }
  return { name: 'P2_health_matches_fixed_buffer_pct_tier_rule', trials: checked, violations };
}

// ---------- P3: monotone — distance_to_liq_pct moves with mark_price in the direction favorable to the position ----------
function checkP3_monotoneDistance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const side = pick(rand, ['long', 'short']);
    const base = mkPP(rand, { side, mark_price: randRange(rand, 100, 100000) });
    const bumped = side === 'long'
      ? { ...base, mark_price: base.mark_price * 1.01 }
      : { ...base, mark_price: base.mark_price * 0.99 };
    const rBase = compute(base);
    const rBump = compute(bumped);
    checked++;
    if (rBump.output_payload.distance_to_liq_pct < rBase.output_payload.distance_to_liq_pct - 1e-6) violations++;
  }
  return { name: 'P3_distance_to_liq_moves_favorably_with_mark_price', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ entry_price: 0.01, mark_price: 0.01, position_size: 0.000001, leverage: 1 }, 'all inputs at documented clamp minimums — must not throw or produce NaN'],
  [{ entry_price: 50000, mark_price: 50000, leverage: 500 }, 'leverage at exact clamp max (500x) — imr/mmr must remain finite'],
  [{ entry_price: 50000, mark_price: 50000, leverage: 0.5 }, 'leverage below clamp min — must clamp to 1, not throw'],
  [{ entry_price: 100, position_size: 0.1 * 3, mark_price: 100 }, 'position_size = 0.1*3 (classic non-exact double) — notional must reflect the EXACT double, round6-rounded'],
  [{ entry_price: 100, position_size: (1 / 3) * 3, mark_price: 100 }, 'position_size = (1/3)*3 (x/y*y!==x artifact) — must round-trip through round6 without throwing'],
  [{ entry_price: Number.MAX_SAFE_INTEGER / 1e6, mark_price: Number.MAX_SAFE_INTEGER / 1e6, position_size: 1 }, 'entry_price near MAX_SAFE_INTEGER scale — must remain finite'],
  [{ mmr_pct: 0 }, 'mmr_pct exactly zero — override must clamp to 0.0001 floor, not divide-by-zero'],
  [{ mmr_pct: -0 }, 'mmr_pct negative zero — must behave as zero, not throw'],
  [{ entry_price: 100, mark_price: 100 + Number.EPSILON, leverage: 5, side: 'long' }, 'mark_price 1 epsilon above entry — buffer_pct/health must not flip on float noise'],
  [{ entry_price: 100, mark_price: 100, leverage: 5, mode: 'cross', side: 'short', spot_offset_usd: 0.1 * 3, correlation: 1 }, 'cross-mode spot_offset_usd = 0.1*3 — cross_margin_efficiency fields must stay finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const nums = [op.notional, op.initial_margin, op.maintenance_threshold, op.unrealized_pnl, op.margin_balance, op.buffer, op.buffer_pct, op.liq_price, op.distance_to_liq_pct];
    const finite = nums.every(Number.isFinite) && ['GREEN', 'AMBER', 'RED'].includes(op.health);
    rows.push({ label, overrides, health: op.health, buffer_pct: op.buffer_pct, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneMargin());
results.properties.push(checkP2_healthTierAgreement());
results.properties.push(checkP3_monotoneDistance());
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

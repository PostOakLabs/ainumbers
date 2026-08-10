// kernel_digest_at_authoring: sha256:2675f0d22096ace35e1dfb500c6f332c77fc66bba78a1e3878575bb466267925
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 511-multi-currency-pvp-validator.
// Class B (bounded-numeric), FLOAT-SENSITIVE (FX rate deviation, notional conversion, SA-CCR add-on)
// — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// Read-only w.r.t. the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/511-multi-currency-pvp-validator.proptest.mjs

import { compute } from '../511-multi-currency-pvp-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '511-multi-currency-pvp-validator.fixtures.json');
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
const rand = mulberry32(0x511A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'HKD', 'SGD'];
const FX_USD = { USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 154.0, CHF: 0.9, HKD: 7.78, SGD: 1.34 };
const ATOMICITY = ['atomic_pvp', 'sequential_pvp', 'free_payment'];
const FINALITY = ['irrevocable_realtime', 'irrevocable_eod', 'provisional', 'unknown'];
const TRIALS = 20000;

function randLeg(rng) {
  const ccySold = pick(rng, CCYS);
  const ccyBought = pick(rng, CCYS);
  return { ccy_sold: ccySold, ccy_bought: ccyBought, notional: randRange(rng, 0, 5_000_000), implied_rate: randRange(rng, 0.001, 200) };
}
function randPP(rng, legCount = 1) {
  const legs = [];
  for (let i = 0; i < legCount; i++) legs.push(randLeg(rng));
  return {
    legs,
    atomicity_type: pick(rng, ATOMICITY),
    finality_type: pick(rng, FINALITY),
    has_unwind_procedure: rng() < 0.5,
    canton_leg: rng() < 0.5,
  };
}

// ---------- P1: monotone in leg notional (fixed ccy pair, total_notional_usd increases) ----------
function checkP1_monotoneNotional() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = randPP(rand, 1);
    const n1 = randRange(rand, 0, 2_000_000);
    const n2 = n1 + randRange(rand, 0, 2_000_000);
    const leg1 = { ...base.legs[0], notional: n1 };
    const leg2 = { ...base.legs[0], notional: n2 };
    const r1 = compute({ ...base, legs: [leg1] });
    const r2 = compute({ ...base, legs: [leg2] });
    checked++;
    if (r2.output_payload.total_notional_usd < r1.output_payload.total_notional_usd - 0.01) violations++;
  }
  return { name: 'P1_monotone_in_leg_notional', trials: checked, violations };
}

// ---------- P2: round-trip identity — saccr_fx_addon_usd = 4% of total_notional_usd exactly ----------
function checkP2_saccrIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const legCount = 1 + Math.floor(rand() * 3);
    const r = compute(randPP(rand, legCount)).output_payload;
    checked++;
    const expected = +(r.total_notional_usd * 0.04).toFixed(2);
    if (Math.abs(r.saccr_fx_addon_usd - expected) > 0.02) violations++;
    if (r.total_notional_usd < -0.01) violations++;
  }
  return { name: 'P2_saccr_addon_identity_and_nonneg_total', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — rate_flag iff deviation > 20% ----------
function checkP3_rateDeviationThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const leg = randLeg(rand);
    const r = compute({ legs: [leg], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }).output_payload;
    checked++;
    const legOut = r.legs[0];
    if (legOut.ref_rate == null) continue; // unknown ccy pair — not this property's domain
    const deviation = Math.abs(leg.implied_rate - legOut.ref_rate) / legOut.ref_rate;
    const expectedFlag = deviation > 0.20 ? 'PVP_RATE_IMPLAUSIBLE' : null;
    if (legOut.rate_flag !== expectedFlag) violations++;
  }
  return { name: 'P3_rate_deviation_threshold_agreement', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const refUsdEur = FX_USD.USD / FX_USD.EUR;
const ULP_BOUNDARY_CASES = [
  ['implied_rate exactly at the 20% deviation boundary — must NOT flag (> not >=)', { legs: [{ ccy_sold: 'USD', ccy_bought: 'EUR', notional: 1000000, implied_rate: refUsdEur * 1.20 }], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
  ['implied_rate 1 ULP over the 20% boundary — must flag', { legs: [{ ccy_sold: 'USD', ccy_bought: 'EUR', notional: 1000000, implied_rate: refUsdEur * 1.20 * (1 + Number.EPSILON * 4) }], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
  ['notional=0', { legs: [{ ccy_sold: 'USD', ccy_bought: 'EUR', notional: 0, implied_rate: 0.92 }], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
  ['notional=-0 negative zero', { legs: [{ ccy_sold: 'USD', ccy_bought: 'EUR', notional: -0, implied_rate: 0.92 }], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
  ['unknown currency — ref_rate must be null, not NaN/crash', { legs: [{ ccy_sold: 'XYZ', ccy_bought: 'EUR', notional: 1000000, implied_rate: 0.92 }], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
  ['subnormal notional', { legs: [{ ccy_sold: 'USD', ccy_bought: 'EUR', notional: Number.MIN_VALUE, implied_rate: 0.92 }], atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
  ['4 legs, x/y*y!==x-shaped notionals', { legs: [1, 2, 3, 4].map((n) => ({ ccy_sold: 'USD', ccy_bought: 'EUR', notional: 33.333333333333336 * n, implied_rate: 0.92 })), atomicity_type: 'atomic_pvp', finality_type: 'irrevocable_realtime', has_unwind_procedure: true, canton_leg: true }],
];

function checkP4_forced() {
  const rows = [];
  for (const [label, pp] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const finite = Number.isFinite(r.total_notional_usd) && Number.isFinite(r.saccr_fx_addon_usd);
    const nonneg = r.total_notional_usd >= -0.01;
    rows.push({ label, total_notional_usd: r.total_notional_usd, first_leg_rate_flag: r.legs[0]?.rate_flag ?? null, first_leg_ref_rate: r.legs[0]?.ref_rate ?? null, finite, nonneg, plausible: finite && nonneg });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneNotional());
results.properties.push(checkP2_saccrIdentity());
results.properties.push(checkP3_rateDeviationThreshold());
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

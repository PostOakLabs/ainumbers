// kernel_digest_at_authoring: sha256:86b52d9ce0d72966dc6be706fe6621eb0c036d9be967792292fb315dad560cbd
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-46-arc-paymaster-model.
// Class B (bounded-numeric), FLOAT-SENSITIVE — gas-cost model multiplies gas units by a gwei-to-USD
// conversion involving a 1e-9 scale factor and a tiny arc_usdc_per_gas_unit constant
// (0.000001), then splits cost by a clamped sponsorship percentage; ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-46-arc-paymaster-model.proptest.mjs

import { compute } from '../art-46-arc-paymaster-model.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-46-arc-paymaster-model.fixtures.json');
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
const rand = mulberry32(0x460B);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 8000;

function mkPP(rng) {
  return {
    gas_per_uop: randRange(rng, 21000, 500000),
    gas_price_gwei: randRange(rng, 1, 200),
    eth_price_usd: randRange(rng, 500, 10000),
    arc_usdc_per_gas_unit: randRange(rng, 0, 0.00001),
    monthly_uops: randRange(rng, 0, 1_000_000),
    merchant_sponsorship_pct: randRange(rng, -20, 120),
    impl_months: randRange(rng, 1, 24),
  };
}

// ---------- P1: monotonicity — eth_cost_per_uop_usd is non-decreasing in gas_per_uop ----------
function checkP1_ethCostNondecreasingInGas() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const higher = { ...pp, gas_per_uop: pp.gas_per_uop + randRange(rand, 1, 10000) };
    checked++;
    const rLo = compute(pp).output_payload.eth_cost_per_uop_usd;
    const rHi = compute(higher).output_payload.eth_cost_per_uop_usd;
    if (rHi < rLo - 1e-6) violations++;
  }
  return { name: 'P1_eth_cost_per_uop_nondecreasing_in_gas_per_uop', trials: checked, violations };
}

// ---------- P2: boundedness — all numeric outputs finite; sponsorship pct effectively clamped to [0,100] ----------
function checkP2_outputsFiniteAndSponsorshipClamped() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const numericFields = [o.eth_cost_per_uop_usd, o.arc_cost_per_uop_full_usd, o.arc_cost_per_uop_user_usd, o.arc_cost_per_uop_merchant_usd, o.saving_per_uop_usd, o.saving_bps, o.monthly_saving_usd, o.annual_saving_usd, o.impl_cost_usd];
    const allFinite = numericFields.every(Number.isFinite);
    const bevenOk = o.break_even_months === null || Number.isFinite(o.break_even_months);
    if (!allFinite || !bevenOk) violations++;
  }
  return { name: 'P2_outputs_finite_or_beven_null', trials: checked, violations };
}

// ---------- P3: round-trip — arc_cost_per_uop_user_usd + arc_cost_per_uop_merchant_usd equals arc_cost_per_uop_full_usd ----------
function checkP3_userPlusMerchantEqualsFull() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const sum = o.arc_cost_per_uop_user_usd + o.arc_cost_per_uop_merchant_usd;
    // tolerance must clear 2x the independent-field toFixed(6) rounding tick (each of the three
    // fields is rounded separately, so worst-case combined drift is 2*5e-7 plus one more ULP)
    if (Math.abs(sum - o.arc_cost_per_uop_full_usd) > Math.max(2e-6, Math.abs(o.arc_cost_per_uop_full_usd) * 1e-4)) violations++;
  }
  return { name: 'P3_user_plus_merchant_cost_equals_full_cost', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ gas_per_uop: 150000, gas_price_gwei: 30, eth_price_usd: 3500, arc_usdc_per_gas_unit: 0.000001, monthly_uops: 10000, merchant_sponsorship_pct: 0 }, 'merchant_sponsorship_pct exactly zero — arc_cost_per_uop_merchant_usd must be exactly 0, user bears full cost'],
  [{ gas_per_uop: 150000, gas_price_gwei: 30, eth_price_usd: 3500, arc_usdc_per_gas_unit: 0.000001, monthly_uops: 10000, merchant_sponsorship_pct: 100 }, 'merchant_sponsorship_pct exactly 100 — arc_cost_per_uop_user_usd must be exactly 0 (ZERO_GAS_USER_EXPERIENCE flag), merchant bears full cost'],
  [{ gas_per_uop: 150000, gas_price_gwei: 30, eth_price_usd: 3500, arc_usdc_per_gas_unit: 0.000001, monthly_uops: 10000, merchant_sponsorship_pct: -20 }, 'merchant_sponsorship_pct negative — kernel clamps via Math.max(0,...) to 0, must not go negative'],
  [{ gas_per_uop: 150000, gas_price_gwei: 30, eth_price_usd: 3500, arc_usdc_per_gas_unit: 0.000001, monthly_uops: 10000, merchant_sponsorship_pct: 120 }, 'merchant_sponsorship_pct over 100 — kernel clamps via Math.min(100,...) to 100, must not exceed 100'],
  [{ gas_per_uop: 150000, gas_price_gwei: 30, eth_price_usd: 3500, arc_usdc_per_gas_unit: 1e-300, monthly_uops: 10000, merchant_sponsorship_pct: 0 }, 'arc_usdc_per_gas_unit at a denormal-range magnitude — must remain finite, no underflow-to-NaN'],
  [{ gas_per_uop: 150000, gas_price_gwei: 30, eth_price_usd: 3500, arc_usdc_per_gas_unit: -0, monthly_uops: 10000, merchant_sponsorship_pct: 0 }, 'arc_usdc_per_gas_unit negative zero — must behave identically to positive zero'],
  [{ gas_per_uop: 21000, gas_price_gwei: 1, eth_price_usd: 500, arc_usdc_per_gas_unit: 0.000001, monthly_uops: 0, merchant_sponsorship_pct: 0 }, 'monthly_uops exactly zero — monthly_saving_usd and annual_saving_usd must be exactly 0'],
  [{ gas_per_uop: 500000, gas_price_gwei: 200, eth_price_usd: 10000, arc_usdc_per_gas_unit: 0.00001, monthly_uops: 1_000_000, merchant_sponsorship_pct: 50 }, 'large-but-realistic gas/price/volume combination — outputs must remain finite, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const numericFields = [o.eth_cost_per_uop_usd, o.arc_cost_per_uop_full_usd, o.arc_cost_per_uop_user_usd, o.arc_cost_per_uop_merchant_usd, o.saving_per_uop_usd, o.saving_bps, o.monthly_saving_usd, o.annual_saving_usd, o.impl_cost_usd];
    const plausible = numericFields.every(Number.isFinite) && (o.break_even_months === null || Number.isFinite(o.break_even_months));
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_ethCostNondecreasingInGas());
results.properties.push(checkP2_outputsFiniteAndSponsorshipClamped());
results.properties.push(checkP3_userPlusMerchantEqualsFull());
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

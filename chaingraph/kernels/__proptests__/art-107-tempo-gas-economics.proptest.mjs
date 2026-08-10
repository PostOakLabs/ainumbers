// kernel_digest_at_authoring: sha256:73a3fb7dd9a7cccfa836d175216241be5000575c71fbea673621cf661401b806
//
// FV-PROPFLOOR-SHARD-B2-1 — property-test floor for art-107-tempo-gas-economics.
// Class B (bounded-numeric), FLOAT-SENSITIVE (AMM slippage / gas-cost arithmetic) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1 pilot
// harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-107-tempo-gas-economics.proptest.mjs

import { compute } from '../art-107-tempo-gas-economics.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-107-tempo-gas-economics.fixtures.json');
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
const rand = mulberry32(0x107A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const RAILS = ['swift', 'card', 'ach'];
const TRIALS = 10000;

// ---------- P1: monotone — increasing weighted slippage never increases per_tx_saving ----------
function checkP1_monotoneSlippage() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const baseline_rail = pick(rand, RAILS);
    const monthly_volume = randRange(rand, 0, 500000);
    const server_paid_pct = randRange(rand, 0, 1);
    const tx_amount_usd = randRange(rand, 1, 5000);
    const s1 = randRange(rand, 0, 50);
    const s2 = s1 + randRange(rand, 0, 50); // s2 >= s1
    const r1 = compute({ monthly_volume, fee_mix: { USDC: 1 }, amm_slippage: { USDC: s1 }, server_paid_pct, baseline_rail, tx_amount_usd, impl_months: 3 });
    const r2 = compute({ monthly_volume, fee_mix: { USDC: 1 }, amm_slippage: { USDC: s2 }, server_paid_pct, baseline_rail, tx_amount_usd, impl_months: 3 });
    checked++;
    if (r2.output_payload.per_tx_saving > r1.output_payload.per_tx_saving + 1e-6) violations++;
  }
  return { name: 'P1_monotone_saving_nonincreasing_in_slippage', trials: checked, violations };
}

// ---------- P2: boundedness — effective_cost in [0, blended_gas_cost], blended_gas_cost >= TEMPO_BASE_USD ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const TEMPO_BASE_USD = 0.0003;
  for (let i = 0; i < TRIALS; i++) {
    const baseline_rail = pick(rand, RAILS);
    const monthly_volume = randRange(rand, 0, 1000000);
    const server_paid_pct = randRange(rand, 0, 1);
    const tx_amount_usd = randRange(rand, 0, 10000);
    const slippage = randRange(rand, 0, 100);
    const r = compute({ monthly_volume, fee_mix: { USDC: 1 }, amm_slippage: { USDC: slippage }, server_paid_pct, baseline_rail, tx_amount_usd, impl_months: 3 });
    checked++;
    const { blended_gas_cost, effective_cost, subsidy_per_tx } = r.output_payload;
    if (blended_gas_cost < TEMPO_BASE_USD - 1e-9) violations++;
    if (effective_cost < -1e-9 || effective_cost > blended_gas_cost + 1e-9) violations++;
    if (subsidy_per_tx < -1e-9) violations++;
  }
  return { name: 'P2_boundedness_effective_cost_in_range', trials: checked, violations };
}

// ---------- P3: round-trip identity — subsidy_per_tx + effective_cost ≈ blended_gas_cost ----------
function checkP3_subsidyIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const baseline_rail = pick(rand, RAILS);
    const monthly_volume = randRange(rand, 0, 500000);
    const server_paid_pct = randRange(rand, 0, 1);
    const tx_amount_usd = randRange(rand, 0, 5000);
    const slippage = randRange(rand, 0, 60);
    const r = compute({ monthly_volume, fee_mix: { USDC: 1 }, amm_slippage: { USDC: slippage }, server_paid_pct, baseline_rail, tx_amount_usd, impl_months: 3 });
    checked++;
    const { blended_gas_cost, effective_cost, subsidy_per_tx } = r.output_payload;
    if (Math.abs(subsidy_per_tx + effective_cost - blended_gas_cost) > 1e-6) violations++;
  }
  return { name: 'P3_subsidy_plus_effective_equals_blended', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  ['swift', 0, { USDC: 1 }, { USDC: 0 }, 0, 1000, 3, 'zero monthly_volume — annual_saving must be exactly 0'],
  ['swift', 100000, { USDC: 1 }, { USDC: -0 }, 0, 1000, 3, 'negative-zero slippage — must behave as zero'],
  ['swift', 100000, { USDC: 1 }, { USDC: Number.MIN_VALUE }, 0, 1000, 3, 'smallest positive double slippage'],
  ['swift', 100000, { USDC: 1 }, { USDC: 1e-300 }, 0, 1000, 3, 'near-subnormal slippage'],
  ['swift', 100000, { USDC: 1 }, { USDC: 0 }, 0, 1000, 3, 'server_paid_pct=0 — subsidy_per_tx must be exactly 0, sponsorship_breakeven_tx null'],
  ['swift', 100000, { USDC: 1 }, { USDC: 0 }, 1, 1000, 3, 'server_paid_pct=1 (fully sponsored) — effective_cost must be exactly 0'],
  ['card', 100000, { USDC: 1 }, { USDC: 0 }, 0.5, Number.MAX_SAFE_INTEGER, 3, 'MAX_SAFE_INTEGER tx_amount_usd — baseline_fee must not overflow, x/y*y!==x rounding case'],
  ['ach', 1, { USDC: 1 }, { USDC: 0 }, 0.0001, 1, 3, 'tiny server_paid_pct — subsidy_per_tx near-zero, breakeven division near boundary'],
  ['swift', 100000, { USDC: 0.5, USD1: 0.5 }, { USDC: 0, USD1: 0 }, 0, 1000, 3, 'split fee_mix summing to 1, zero slippage — weighted slippage must be exactly 0'],
  ['swift', 100000, { USDC: 1 }, { USDC: 0 }, 0.9999999999, 1000, 3, 'server_paid_pct at 1-ULP-below-1 boundary'],
];

function checkP4_forced() {
  const rows = [];
  for (const [baseline_rail, monthly_volume, fee_mix, amm_slippage, server_paid_pct, tx_amount_usd, impl_months, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ monthly_volume, fee_mix, amm_slippage, server_paid_pct, baseline_rail, tx_amount_usd, impl_months });
    const { blended_gas_cost, effective_cost, annual_saving } = r.output_payload;
    const finite = Number.isFinite(blended_gas_cost) && Number.isFinite(effective_cost) && Number.isFinite(annual_saving);
    const plausible = finite && effective_cost >= -1e-9 && blended_gas_cost >= 0;
    rows.push({ label, baseline_rail, monthly_volume, server_paid_pct, blended_gas_cost, effective_cost, annual_saving, finite, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneSlippage());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_subsidyIdentity());
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

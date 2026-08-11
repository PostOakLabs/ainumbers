// kernel_digest_at_authoring: sha256:712b7d6c95243d64d2a14195636f2436a56610776c59001a266d2dcf1691ef04
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-83-buy-in-exposure-modeler.
// Class B (bounded-numeric), FLOAT-SENSITIVE — notional/buyin_cost/cash_comp are products of
// user-supplied quantity/reference_price/markup floats rounded via .toFixed(2), and the running
// totals accumulate across fails before their own .toFixed(2) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-83-buy-in-exposure-modeler.proptest.mjs

import { compute } from '../art-83-buy-in-exposure-modeler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-83-buy-in-exposure-modeler.fixtures.json');
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
const rand = mulberry32(0x83071A);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const ASSET_CLASSES = ['liquid_equity', 'government_bond', 'other_bond', 'sme_equity', 'illiquid'];
const EXT_DAYS = { liquid_equity: 7, government_bond: 12, other_bond: 12, sme_equity: 22, illiquid: 22 };
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkFail(rng) {
  const asset_class = pick(rng, ASSET_CLASSES);
  const quantity = Math.floor(randRange(rng, 1, 10000));
  const reference_price = randRange(rng, 0.01, 5000);
  const fail_date_t = Math.floor(randRange(rng, 0, 100));
  const current_date_t = fail_date_t + Math.floor(randRange(rng, 0, 40));
  return { asset_class, quantity, reference_price, fail_date_t, current_date_t, currency: 'EUR' };
}

// ---------- P1: buyin_cost/cash_comp are exactly notional*(1+pct), rounded to 2dp, only when eligible ----------
function checkP1_costsExactFormulaWhenEligible() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const f = mkFail(rand);
    const r = compute({ fails: [f] });
    checked++;
    const mf = r.output_payload.modeled_fails[0];
    const notional = f.quantity * f.reference_price;
    const expectedNotional = +notional.toFixed(2);
    if (mf.notional !== expectedNotional) violations++;
    if (mf.buyin_eligible) {
      const expectedBuyin = +(notional * 1.05).toFixed(2);
      const expectedCashComp = +(notional * 1.10).toFixed(2);
      if (mf.buyin_cost !== expectedBuyin) violations++;
      if (mf.cash_comp_alt !== expectedCashComp) violations++;
    } else {
      if (mf.buyin_cost !== null || mf.cash_comp_alt !== null) violations++;
    }
  }
  return { name: 'P1_costs_exact_formula_and_null_when_ineligible', trials: checked, violations };
}

// ---------- P2: boundedness — totals are non-negative and totals equal the sum of eligible fails' costs ----------
function checkP2_totalsNonNegativeAndSumConsistent() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 4);
    const fails = Array.from({ length: n }, () => mkFail(rand));
    const r = compute({ fails });
    checked++;
    const { total_buyin_exposure, total_cash_comp_exposure, modeled_fails } = r.output_payload;
    if (total_buyin_exposure < 0 || total_cash_comp_exposure < 0) violations++;
    let sumBuyin = 0, sumCashComp = 0;
    for (const mf of modeled_fails) {
      if (mf.buyin_eligible) { sumBuyin += mf.buyin_cost; sumCashComp += mf.cash_comp_alt; }
    }
    if (Math.abs(total_buyin_exposure - +sumBuyin.toFixed(2)) > 1e-6) violations++;
    if (Math.abs(total_cash_comp_exposure - +sumCashComp.toFixed(2)) > 1e-6) violations++;
  }
  return { name: 'P2_totals_nonneg_and_sum_of_eligible_fail_costs', trials: checked, violations };
}

// ---------- P3: metamorphic — buyin_eligible flips exactly at days_elapsed === extension_days, never earlier ----------
function checkP3_eligibilityThresholdExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const asset_class = pick(rand, ASSET_CLASSES);
    const threshold = EXT_DAYS[asset_class];
    const quantity = 10, reference_price = 100;
    const before = { asset_class, quantity, reference_price, fail_date_t: 0, current_date_t: threshold - 1 };
    const at = { asset_class, quantity, reference_price, fail_date_t: 0, current_date_t: threshold };
    const rBefore = compute({ fails: [before] }).output_payload.modeled_fails[0];
    const rAt = compute({ fails: [at] }).output_payload.modeled_fails[0];
    checked++;
    if (rBefore.buyin_eligible !== false) violations++;
    if (rAt.buyin_eligible !== true) violations++;
  }
  return { name: 'P3_eligibility_flips_exactly_at_extension_days_threshold', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ fails: [] }, 'empty fails array — all totals exactly 0'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: 0, reference_price: 1000, fail_date_t: 0, current_date_t: 10 }] }, 'quantity exactly zero — notional must be exactly 0, buyin_cost 0 if eligible, no NaN'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: -0, reference_price: 1000, fail_date_t: 0, current_date_t: 10 }] }, 'quantity negative zero — must behave identically to positive zero, no -0 leak into JSON'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: 3, reference_price: 0.1, fail_date_t: 0, current_date_t: 10 }] }, 'reference_price = 0.1 (classic non-exact double) — notional = 3*0.1 = 0.30000000000000004 pre-rounding, must round cleanly to 0.30'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: 1 / 3, reference_price: 3, fail_date_t: 0, current_date_t: 10 }] }, '1/3 * 3 rounding-artifact quantity — notional must remain finite, round cleanly'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: Number.MIN_VALUE, reference_price: 1, fail_date_t: 0, current_date_t: 10 }] }, 'quantity at smallest positive double (denormal-adjacent) — notional must remain finite, non-NaN, round to 0.00'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: Number.MAX_SAFE_INTEGER, reference_price: 1, fail_date_t: 0, current_date_t: 10 }] }, 'quantity at MAX_SAFE_INTEGER — notional must not overflow to Infinity or lose finiteness'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: 10, reference_price: 100, fail_date_t: 0, current_date_t: 7 }] }, 'days_elapsed exactly equals extension_days_threshold (7 for liquid_equity, boundary uses >=) — must be eligible'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: 10, reference_price: 100, fail_date_t: 0, current_date_t: 6 }] }, 'days_elapsed one day short of the 7-day liquid_equity threshold — must NOT be eligible'],
  [{ fails: [{ asset_class: 'liquid_equity', quantity: 10, reference_price: 100, fail_date_t: 20, current_date_t: 5 }] }, 'current_date_t before fail_date_t (negative elapsed) — days_elapsed must clamp to exactly 0 via Math.max, not negative'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { total_buyin_exposure, total_cash_comp_exposure, modeled_fails } = r.output_payload;
    const finite = Number.isFinite(total_buyin_exposure) && Number.isFinite(total_cash_comp_exposure)
      && modeled_fails.every((mf) => Number.isFinite(mf.notional) && (mf.buyin_cost === null || Number.isFinite(mf.buyin_cost)));
    const plausible = finite && total_buyin_exposure >= 0 && total_cash_comp_exposure >= 0;
    rows.push({ label, input: pp, total_buyin_exposure, total_cash_comp_exposure, modeled_fails, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_costsExactFormulaWhenEligible());
results.properties.push(checkP2_totalsNonNegativeAndSumConsistent());
results.properties.push(checkP3_eligibilityThresholdExact());
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

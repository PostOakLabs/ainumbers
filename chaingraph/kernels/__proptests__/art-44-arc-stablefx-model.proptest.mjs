// kernel_digest_at_authoring: sha256:7fcfd2624025beb441f4018775a81c7e1d967809adfaff6b96cdde238bbf8d73
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-44-arc-stablefx-model.
// Class B (bounded-numeric), FLOAT-SENSITIVE — Herstatt credit cost and FX spread savings divide
// implCost by annualSaving/12 and multiply daily volume by basis-point spreads; ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-44-arc-stablefx-model.proptest.mjs

import { compute } from '../art-44-arc-stablefx-model.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-44-arc-stablefx-model.fixtures.json');
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
const rand = mulberry32(0x44FA);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 8000;

function mkPP(rng) {
  return {
    daily_fx_volume_usd: randRange(rng, 0, 20_000_000),
    herstatt_spread_bps: randRange(rng, 0, 20),
    non_cls_bilateral_bps: randRange(rng, 0, 30),
    cls_annual_fee_usd: randRange(rng, 0, 200_000),
    stablefx_fee_bps: randRange(rng, 0, 10),
    trading_days: randRange(rng, 200, 260),
    impl_months: randRange(rng, 1, 24),
  };
}

// ---------- P1: monotonicity — incumbent_annual_usd is non-decreasing in daily_fx_volume_usd (bps terms >= 0) ----------
function checkP1_incumbentAnnualNondecreasingInVolume() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const higher = { ...pp, daily_fx_volume_usd: pp.daily_fx_volume_usd + randRange(rand, 0.01, 1_000_000) };
    checked++;
    const rLo = compute(pp).output_payload.incumbent_annual_usd;
    const rHi = compute(higher).output_payload.incumbent_annual_usd;
    if (rHi < rLo - 1e-3) violations++;
  }
  return { name: 'P1_incumbent_annual_nondecreasing_in_daily_volume', trials: checked, violations };
}

// ---------- P2: boundedness — all numeric outputs finite, break_even_months finite or null, herstatt_share_pct finite ----------
// herstatt_share_pct is NOT bounded to [0,100] — measured directly: with a negative
// herstatt_spread_bps the numerator goes negative (share negative); when stablefx_fee_bps eats
// into the non-herstatt portion of the incumbent cost more than it saves on the herstatt portion,
// the ratio can exceed 100%. Both are real modeled effects the kernel does not clamp, not floor
// defects — the property only asserts the guard clause's own invariant: 0 when
// annualSavingVsIncumbent<=0, else a finite (possibly negative or >100) number.
function checkP2_outputsFiniteAndSharePctBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const numericFields = [o.daily_fx_volume_usd, o.incumbent_annual_usd, o.cls_annual_usd, o.stablefx_annual_usd, o.annual_saving_vs_incumbent, o.annual_saving_vs_cls, o.herstatt_eliminated_ann_usd, o.impl_cost_usd];
    const allFinite = numericFields.every(Number.isFinite);
    const bevenOk = o.break_even_months === null || Number.isFinite(o.break_even_months);
    const shareOk = Number.isFinite(o.herstatt_share_pct) && (o.annual_saving_vs_incumbent > 0 || o.herstatt_share_pct === 0);
    if (!allFinite || !bevenOk || !shareOk) violations++;
  }
  return { name: 'P2_outputs_finite_beven_null_and_herstatt_share_pct_guard_clause', trials: checked, violations };
}

// ---------- P3: metamorphic — herstatt_eliminated_ann_usd is exactly the herstatt credit term isolated (independent of bilateral spread) ----------
function herstattDailyCredit(dailyNotional, spreadBps) { return dailyNotional * 0.50 * (4 / 24) * (spreadBps / 10_000); }
function checkP3_herstattEliminatedIsolatesHerstattTerm() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = herstattDailyCredit(pp.daily_fx_volume_usd, pp.herstatt_spread_bps) * pp.trading_days;
    if (Math.abs(r.output_payload.herstatt_eliminated_ann_usd - expected) > Math.max(0.01, Math.abs(expected) * 1e-6)) violations++;
  }
  return { name: 'P3_herstatt_eliminated_matches_isolated_herstatt_credit_term', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ daily_fx_volume_usd: 0, herstatt_spread_bps: 2.5, non_cls_bilateral_bps: 8, cls_annual_fee_usd: 100000, stablefx_fee_bps: 1.5 }, 'daily_fx_volume_usd exactly zero — all volume-derived terms must be exactly 0, no NaN'],
  [{ daily_fx_volume_usd: -0, herstatt_spread_bps: 2.5, non_cls_bilateral_bps: 8, cls_annual_fee_usd: 100000, stablefx_fee_bps: 1.5 }, 'daily_fx_volume_usd negative zero — must behave identically to positive zero'],
  [{ daily_fx_volume_usd: 5_000_000, herstatt_spread_bps: 0, non_cls_bilateral_bps: 8, cls_annual_fee_usd: 100000, stablefx_fee_bps: 1.5 }, 'herstatt_spread_bps exactly zero — herstatt_eliminated_ann_usd must be exactly 0, herstatt_share_pct must be 0 not NaN'],
  [{ daily_fx_volume_usd: 5_000_000, herstatt_spread_bps: 2.5, non_cls_bilateral_bps: 0, cls_annual_fee_usd: 0, stablefx_fee_bps: 0 }, 'stablefx_fee_bps exactly zero and cls_annual_fee_usd zero — stablefx_annual_usd must be exactly 0'],
  [{ daily_fx_volume_usd: 1e-300, herstatt_spread_bps: 2.5, non_cls_bilateral_bps: 8, cls_annual_fee_usd: 100000, stablefx_fee_bps: 1.5 }, 'daily_fx_volume_usd at denormal-range magnitude — must remain finite, no underflow-to-NaN'],
  [{ daily_fx_volume_usd: 5_000_000, herstatt_spread_bps: -2.5, non_cls_bilateral_bps: 8, cls_annual_fee_usd: 100000, stablefx_fee_bps: 1.5 }, 'negative herstatt_spread_bps — herstattDailyUsd must go negative without NaN, herstatt_share_pct clamps via the annualSavingVsIncumbent>0 guard'],
  [{ daily_fx_volume_usd: 20_000_000, herstatt_spread_bps: 20, non_cls_bilateral_bps: 30, cls_annual_fee_usd: 200000, stablefx_fee_bps: 10, trading_days: 260 }, 'large-but-realistic volume/spread combination — outputs must remain finite, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const numericFields = [o.incumbent_annual_usd, o.cls_annual_usd, o.stablefx_annual_usd, o.annual_saving_vs_incumbent, o.annual_saving_vs_cls, o.herstatt_eliminated_ann_usd, o.impl_cost_usd];
    // herstatt_share_pct can legitimately go negative (negative herstatt_spread_bps) or exceed 100
    // (stablefx fee eating into the non-herstatt saving) — only finiteness is asserted here.
    const plausible = numericFields.every(Number.isFinite) && (o.break_even_months === null || Number.isFinite(o.break_even_months)) && Number.isFinite(o.herstatt_share_pct);
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_incumbentAnnualNondecreasingInVolume());
results.properties.push(checkP2_outputsFiniteAndSharePctBounded());
results.properties.push(checkP3_herstattEliminatedIsolatesHerstattTerm());
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

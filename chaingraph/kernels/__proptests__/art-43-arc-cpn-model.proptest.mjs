// kernel_digest_at_authoring: sha256:b63c0541028ab8fc4734ed626c01d898b2248c38df45a7136d68bc76669a4f91
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-43-arc-cpn-model.
// Class B (bounded-numeric), FLOAT-SENSITIVE — corridor cost model divides implCost by
// annualSaving/12 and multiplies rail fees + fx spread bps by notional_usd; ULP-boundary forcing
// is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-43-arc-cpn-model.proptest.mjs

import { compute } from '../art-43-arc-cpn-model.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-43-arc-cpn-model.fixtures.json');
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
const rand = mulberry32(0x43F1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const RAILS = ['swift', 'ach', 'sepa', 'card', 'rtp'];

function mkPP(rng) {
  return {
    rail: pick(rng, RAILS),
    notional_usd: randRange(rng, 0, 1_000_000),
    monthly_volume: randRange(rng, 0, 5000),
    impl_months: randRange(rng, 1, 24),
  };
}

// ---------- P1: monotonicity — per_tx_incumbent_usd is non-decreasing in notional_usd (pct + fx spread >= 0) ----------
function checkP1_incumbentNondecreasingInNotional() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const lower = { ...pp };
    const higher = { ...pp, notional_usd: pp.notional_usd + randRange(rand, 0.01, 5000) };
    checked++;
    const rLo = compute(lower).output_payload.per_tx_incumbent_usd;
    const rHi = compute(higher).output_payload.per_tx_incumbent_usd;
    if (rHi < rLo - 1e-6) violations++;
  }
  return { name: 'P1_per_tx_incumbent_nondecreasing_in_notional', trials: checked, violations };
}

// ---------- P2: boundedness — all numeric outputs finite, break_even_months finite or null ----------
function checkP2_outputsFiniteOrNull() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const numericFields = [o.per_tx_incumbent_usd, o.per_tx_cpn_usd, o.per_tx_saving_usd, o.saving_bps, o.fx_spread_bps_applied, o.monthly_saving_usd, o.annual_saving_usd, o.npv_3yr_usd, o.impl_cost_usd];
    const allFinite = numericFields.every(Number.isFinite);
    const bevenOk = o.break_even_months === null || Number.isFinite(o.break_even_months);
    if (!allFinite || !bevenOk) violations++;
  }
  return { name: 'P2_outputs_finite_or_beven_null', trials: checked, violations };
}

// ---------- P3: round-trip — npv_3yr_usd equals annual_saving_usd*3 - impl_cost_usd, recomputed from RAW (unrounded) fields ----------
const RAIL_FEES = { swift: { fixed: 18.00, pct: 0.0010 }, ach: { fixed: 0.26, pct: 0.0000 }, sepa: { fixed: 0.09, pct: 0.0000 }, card: { fixed: 0.10, pct: 0.0150 }, rtp: { fixed: 0.045, pct: 0.0005 } };
const RAIL_FX_SPREAD_BPS = { swift: 150, ach: 0, sepa: 0, card: 100, rtp: 0 };
const CPN_FIXED = 0.01, IMPL_COST_PER_MONTH = 12_000;
function checkP3_npvRoundtripsFromRawInputs() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const railFee = RAIL_FEES[pp.rail] ?? RAIL_FEES.swift;
    const fxBps = RAIL_FX_SPREAD_BPS[pp.rail] ?? 0;
    const fxCost = pp.notional_usd * (fxBps / 10_000);
    const perTxIncumbent = railFee.fixed + pp.notional_usd * railFee.pct + fxCost;
    const perTxSaving = perTxIncumbent - CPN_FIXED;
    const annualSaving = perTxSaving * pp.monthly_volume * 12;
    const implCost = pp.impl_months * IMPL_COST_PER_MONTH;
    const expectedNpv = annualSaving * 3 - implCost;
    if (Math.abs(r.output_payload.npv_3yr_usd - expectedNpv) > Math.max(1, Math.abs(expectedNpv) * 1e-6)) violations++;
  }
  return { name: 'P3_npv_3yr_equals_annual_saving_times_3_minus_impl_cost_from_raw', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ rail: 'swift', notional_usd: 0, monthly_volume: 100, impl_months: 3 }, 'notional_usd exactly zero — per_tx_incumbent_usd must equal rail fixed fee exactly, fx cost exactly 0'],
  [{ rail: 'swift', notional_usd: -0, monthly_volume: 100, impl_months: 3 }, 'notional_usd negative zero — must behave identically to positive zero'],
  [{ rail: 'ach', notional_usd: 1e-300, monthly_volume: 100, impl_months: 3 }, 'notional_usd at denormal-range magnitude — must remain finite'],
  [{ rail: 'sepa', notional_usd: 1000, monthly_volume: 100, impl_months: 3, fx_spread_bps: 0 }, 'explicit fx_spread_bps override of zero (overrides RAIL_FX_SPREAD_BPS default) — fx_spread_bps_applied must be exactly 0, not the default'],
  [{ rail: 'sepa', notional_usd: 1000, monthly_volume: 100, impl_months: 3, fx_spread_bps: -1 }, 'negative fx_spread_bps — fxCostIncumbent must go negative, no NaN'],
  [{ rail: 'card', notional_usd: 1000, monthly_volume: 100, impl_months: 3, cpn_fee_usd: 0 }, 'explicit cpn_fee_usd override of zero — per_tx_cpn_usd must equal exactly 0, not the CPN_FIXED default'],
  [{ rail: 'unknown', notional_usd: 1000, monthly_volume: 100, impl_months: 3 }, 'unrecognized rail falls back to swift fee table and swift fx spread — must not throw'],
  [{ rail: 'swift', notional_usd: 1_000_000, monthly_volume: 5000, impl_months: 1 }, 'large-but-realistic notional/volume combination — outputs must remain finite, no overflow'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const numericFields = [o.per_tx_incumbent_usd, o.per_tx_cpn_usd, o.per_tx_saving_usd, o.saving_bps, o.fx_spread_bps_applied, o.monthly_saving_usd, o.annual_saving_usd, o.npv_3yr_usd, o.impl_cost_usd];
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

results.properties.push(checkP1_incumbentNondecreasingInNotional());
results.properties.push(checkP2_outputsFiniteOrNull());
results.properties.push(checkP3_npvRoundtripsFromRawInputs());
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

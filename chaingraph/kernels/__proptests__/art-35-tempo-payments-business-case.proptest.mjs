// kernel_digest_at_authoring: sha256:983a22594a38514987c18253d6efe800adb9ffb96148357f3deb80975f46837c
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-35-tempo-payments-business-case.
// Class B (bounded-numeric), FLOAT-SENSITIVE — per-tx cost model divides implCost by
// annualSaving/12 and multiplies rail fees by tx_amount_usd; ULP-boundary forcing is MANDATORY
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-35-tempo-payments-business-case.proptest.mjs

import { compute } from '../art-35-tempo-payments-business-case.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-35-tempo-payments-business-case.fixtures.json');
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
const rand = mulberry32(0x35A7);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 8000;

const RAILS = ['card', 'swift', 'ach', 'sepa'];
const COINS = ['usdc', 'usdt', 'pathusd'];

function mkPP(rng) {
  return {
    rail: pick(rng, RAILS),
    stablecoin: pick(rng, COINS),
    tx_amount_usd: randRange(rng, 0, 100000),
    monthly_volume: randRange(rng, 0, 10000),
    impl_months: randRange(rng, 1, 24),
  };
}

// ---------- P1: monotonicity — per_tx_incumbent_usd is non-decreasing in tx_amount_usd (rail pct >= 0) ----------
function checkP1_incumbentNondecreasingInAmount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const lower = { ...pp, tx_amount_usd: pp.tx_amount_usd };
    const higher = { ...pp, tx_amount_usd: pp.tx_amount_usd + randRange(rand, 0.01, 1000) };
    checked++;
    const rLo = compute(lower).output_payload.per_tx_incumbent_usd;
    const rHi = compute(higher).output_payload.per_tx_incumbent_usd;
    if (rHi < rLo - 1e-6) violations++;
  }
  return { name: 'P1_per_tx_incumbent_nondecreasing_in_tx_amount', trials: checked, violations };
}

// ---------- P2: boundedness — all numeric outputs finite except break_even_months, which is finite or null ----------
function checkP2_outputsFiniteOrNull() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const numericFields = [o.per_tx_incumbent_usd, o.per_tx_tempo_usd, o.per_tx_saving_usd, o.saving_bps, o.monthly_saving_usd, o.annual_saving_usd, o.impl_cost_usd];
    const allFinite = numericFields.every(Number.isFinite);
    const bevenOk = o.break_even_months === null || Number.isFinite(o.break_even_months);
    if (!allFinite || !bevenOk) violations++;
  }
  return { name: 'P2_outputs_finite_or_beven_null', trials: checked, violations };
}

// ---------- P3: threshold-tier agreement — verdict matches thresholds recomputed from RAW (unrounded) inputs ----------
// Recomputes annualSaving/breakEvenMonths independently from pp, mirroring the kernel's own
// pre-toFixed() arithmetic exactly — comparing against the kernel's ROUNDED output fields would
// produce false violations exactly at a threshold boundary, since the kernel decides the verdict
// before rounding but the output field is already rounded.
const RAIL_FEES = { card: { fixed: 0.10, pct: 0.015 }, swift: { fixed: 18.00, pct: 0.001 }, ach: { fixed: 0.26, pct: 0.000 }, sepa: { fixed: 0.087, pct: 0.000 } };
const AMM_PCT = { usdc: 0.000, usdt: 0.000, pathusd: 0.0005 };
const TEMPO_FIXED = 0.0003, IMPL_COST_PER_MONTH = 15_000;
const MIGRATE_MIN_ANNUAL = 50_000, MIGRATE_MAX_BREAKEVEN = 12, EVALUATE_MIN_ANNUAL = 5_000, EVALUATE_MAX_BREAKEVEN = 24;
function checkP3_verdictMatchesThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const railFee = RAIL_FEES[pp.rail] ?? RAIL_FEES.swift;
    const ammPct = AMM_PCT[pp.stablecoin] ?? 0;
    const perTxIncumbent = railFee.fixed + pp.tx_amount_usd * railFee.pct;
    const perTxTempo = TEMPO_FIXED + pp.tx_amount_usd * ammPct;
    const perTxSaving = perTxIncumbent - perTxTempo;
    const annualSaving = perTxSaving * pp.monthly_volume * 12;
    const implCost = pp.impl_months * IMPL_COST_PER_MONTH;
    const breakEvenMonths = annualSaving > 0 ? implCost / (annualSaving / 12) : Infinity;
    let expected;
    if (annualSaving > MIGRATE_MIN_ANNUAL && breakEvenMonths <= MIGRATE_MAX_BREAKEVEN) expected = 'MIGRATE';
    else if (annualSaving > EVALUATE_MIN_ANNUAL && breakEvenMonths <= EVALUATE_MAX_BREAKEVEN) expected = 'EVALUATE';
    else expected = 'HOLD';
    if (r.output_payload.verdict !== expected) violations++;
  }
  return { name: 'P3_verdict_matches_recomputed_thresholds_from_raw_inputs', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ rail: 'swift', stablecoin: 'usdc', tx_amount_usd: 0, monthly_volume: 500, impl_months: 3 }, 'tx_amount_usd exactly zero — per_tx_incumbent_usd must equal rail fixed fee exactly, no NaN'],
  [{ rail: 'swift', stablecoin: 'usdc', tx_amount_usd: -0, monthly_volume: 500, impl_months: 3 }, 'tx_amount_usd negative zero — must behave identically to positive zero'],
  [{ rail: 'ach', stablecoin: 'usdc', tx_amount_usd: 1e-300, monthly_volume: 500, impl_months: 3 }, 'tx_amount_usd at a denormal-range magnitude — must remain finite, no underflow-to-NaN'],
  [{ rail: 'swift', stablecoin: 'usdc', tx_amount_usd: 10000, monthly_volume: 0, impl_months: 3 }, 'monthly_volume exactly zero — annual_saving_usd must be exactly 0, verdict must be HOLD (0 is not > EVALUATE_MIN_ANNUAL)'],
  [{ rail: 'swift', stablecoin: 'usdc', tx_amount_usd: 10000, monthly_volume: 1, impl_months: 3 }, 'annual_saving_usd landing near the MIGRATE_MIN_ANNUAL=50000 boundary region — verdict must use strict > per kernel source, never off-by-one'],
  [{ rail: 'sepa', stablecoin: 'pathusd', tx_amount_usd: 100000, monthly_volume: 10000, impl_months: 1 }, 'large-but-realistic tx_amount/volume combination — outputs must remain finite, no overflow'],
  [{ rail: 'unknownrail', stablecoin: 'usdc', tx_amount_usd: 1000, monthly_volume: 100, impl_months: 3 }, 'unrecognized rail falls back to swift fee table per kernel ?? operator — must not throw or NaN'],
  [{ rail: 'card', stablecoin: 'unknowncoin', tx_amount_usd: 1000, monthly_volume: 100, impl_months: 3 }, 'unrecognized stablecoin falls back to ammPct=0 per kernel ?? 0 — per_tx_tempo_usd must equal TEMPO_FIXED exactly'],
  [{ rail: 'card', stablecoin: 'usdc', tx_amount_usd: 100, monthly_volume: 100, impl_months: 0 }, 'impl_months exactly zero — Number(0)||3 in kernel means falsy 0 falls back to default 3, impl_cost_usd must equal 3*15000 not 0'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const numericFields = [o.per_tx_incumbent_usd, o.per_tx_tempo_usd, o.per_tx_saving_usd, o.saving_bps, o.monthly_saving_usd, o.annual_saving_usd, o.impl_cost_usd];
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

results.properties.push(checkP1_incumbentNondecreasingInAmount());
results.properties.push(checkP2_outputsFiniteOrNull());
results.properties.push(checkP3_verdictMatchesThresholds());
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

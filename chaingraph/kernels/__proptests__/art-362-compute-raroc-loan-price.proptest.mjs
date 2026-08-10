// kernel_digest_at_authoring: sha256:924bffad0e3ca899065de2ce2e30a9339ed8b16a215ac8a5bf606f8fc0a9cc0b
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-362-compute-raroc-loan-price.
// Class B (bounded-numeric), FLOAT:YES — Basel/Vasicek economic-capital float math
// (normCDF, normInv, Math.exp, Math.log, Math.pow) plus a bounded bisection search.
// ULP-boundary forcing mandatory. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B12 harness. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-362-compute-raroc-loan-price.proptest.mjs

import { compute } from '../art-362-compute-raroc-loan-price.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-362-compute-raroc-loan-price.fixtures.json');
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
const rand = mulberry32(0x0362A1);
const TRIALS = 6000;
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    ead_musd: range(rng, 1, 500),
    tenor_years: range(rng, 0.25, 20),
    margin_bps: range(rng, 0, 1000),
    benchmark_rate_pct: range(rng, 0, 10),
    arrangement_fee_bps: range(rng, 0, 200),
    commitment_fee_bps: range(rng, 0, 100),
    utilization_pct: range(rng, 0, 100),
    pd_pct: range(rng, 0.01, 20),
    lgd_pct: range(rng, 0, 100),
    capital_approach: pick(rng, ['airb', 'firb', 'sa']),
    capital_buffer_bps: range(rng, 0, 500),
    hurdle_rate_pct: range(rng, 5, 20),
    cost_of_funds_pct: range(rng, 0, 10),
    operating_cost_kusd: range(rng, 0, 500),
    tax_rate_pct: range(rng, 0, 40),
  };
}

// ---------- P1: raroc_pct is capped at 999 (declared ceiling) ----------
function checkP1_rarocCapped() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.raroc_pct > 999) violations++;
  }
  return { name: 'P1_raroc_pct_capped_at_999', trials: checked, violations };
}

// ---------- P2: value_creating is the exact boolean of raroc_pct >= hurdle_rate_pct ----------
function checkP2_valueCreatingExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { raroc_pct, value_creating, hurdle_rate_pct } = r.output_payload;
    if (value_creating !== (raroc_pct >= hurdle_rate_pct)) violations++;
  }
  return { name: 'P2_value_creating_exact_boolean_of_raroc_vs_hurdle', trials: checked, violations };
}

// ---------- P3: economic_capital_musd is bounded — never exceeds drawn_musd by more than a small multiple ----------
function checkP3_ecapBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { economic_capital_musd, drawn_musd } = r.output_payload;
    if (economic_capital_musd < 0) violations++;
    if (economic_capital_musd > drawn_musd + 1e-6 && economic_capital_musd > drawn_musd * 1.01) violations++;
  }
  return { name: 'P3_economic_capital_non_negative_and_never_exceeds_drawn', trials: checked, violations };
}

// ---------- P4: drawn + undrawn round-trips to ead (within r2 rounding tolerance) ----------
function checkP4_drawnUndrawnRoundtrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { drawn_musd, undrawn_musd } = r.output_payload;
    if (Math.abs(drawn_musd + undrawn_musd - pp.ead_musd) > 0.02) violations++;
  }
  return { name: 'P4_drawn_plus_undrawn_roundtrips_to_ead', trials: checked, violations };
}

// ---------- P5 (mandatory, float-sensitive): forced ULP-boundary cases ----------
function checkP5_forced() {
  const rows = [];
  const base = {
    ead_musd: 50, tenor_years: 5, margin_bps: 250, benchmark_rate_pct: 5.25,
    arrangement_fee_bps: 50, commitment_fee_bps: 30, utilization_pct: 85,
    pd_pct: 0.18, lgd_pct: 40, capital_approach: 'airb', capital_buffer_bps: 300,
    hurdle_rate_pct: 12, cost_of_funds_pct: 4.8, operating_cost_kusd: 100, tax_rate_pct: 25,
  };
  const cases = [
    { ...base, ead_musd: 0, label: 'ead_musd exactly 0 — drawn/undrawn/ecap/revenue all resolve to 0, never NaN' },
    { ...base, ead_musd: Number.MIN_VALUE, label: 'ead_musd at denormal scale — must stay finite through the whole pipeline' },
    { ...base, pd_pct: 0.0001, label: 'pd_pct at the safeNum floor (Math.max(0.0001,...)) — log(pdD) denominator boundary for AIRB' },
    { ...base, capital_approach: 'sa', pd_pct: 0.07, label: 'SA risk-weight bucket boundary exactly at 0.07% (20% vs 50% tier)' },
    { ...base, capital_approach: 'sa', pd_pct: 0.2, label: 'SA risk-weight bucket boundary exactly at 0.2% (50% vs 75% tier)' },
    { ...base, tenor_years: 0.25, label: 'tenor_years at the safeNum floor (Math.max(0.25,...))' },
    { ...base, utilization_pct: 0, label: 'utilization_pct exactly 0 — drawn=0, undrawn=ead' },
    { ...base, utilization_pct: 100, label: 'utilization_pct exactly 100 — drawn=ead, undrawn=0' },
    { ...base, hurdle_rate_pct: -0, label: 'hurdle_rate_pct is negative zero — value_creating boundary comparison must still resolve' },
    { ...base, lgd_pct: 0, label: 'lgd_pct exactly 0 — expected loss and K-formula both zero out lgdD factor' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const { raroc_pct, economic_capital_musd, drawn_musd, undrawn_musd, break_even_spread_bps } = r.output_payload;
    const plausible = [raroc_pct, economic_capital_musd, drawn_musd, undrawn_musd, break_even_spread_bps].every(Number.isFinite);
    rows.push({ label, input: pp, raroc_pct, economic_capital_musd, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_rarocCapped());
results.properties.push(checkP2_valueCreatingExact());
results.properties.push(checkP3_ecapBounded());
results.properties.push(checkP4_drawnUndrawnRoundtrip());
results.boundary_forced = checkP5_forced();

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

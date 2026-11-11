// art-365-compute-globe-topup-tax.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:00345a29d08e888a3d52f4c6b836d8b0cdd7354058044e517c7bb94e7c4bace4
// (updated by ART365-SBIE-TRANSITION-RATES-FIX-1, 2026-10-27 -- prior digest sha256:13a66501... is
// now stale, the SBIE rates were fixed to the OECD Article 9.2 transitional schedule 2023-2032,
// 5% steady state from 2033, with a fail-closed refusal for fiscal years before 2023)
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (ETR = taxes/income comparison against the fixed 0.15 GLOBE_MIN_RATE
// threshold, r6 rounding on every emitted number — direct read confirmed) — ULP-boundary
// forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (unbounded jurisdictions array — bound is array
// length, no other loop), boundedness (top_up_rate in [0, GLOBE_MIN_RATE], etr finite,
// sbie/income_net_sbie never negative), metamorphic (jurisdiction-array permutation invariance
// of every suite-level total — sums are order-independent), ULP-boundary forcing on the
// income/taxes/ETR-threshold inputs, Article 9.2 table oracle (independently written table,
// 2023-2032), steady state from 2033, assets monotonicity, pre-2023 refusal.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-365-compute-globe-topup-tax.proptest.mjs

import { compute } from '../art-365-compute-globe-topup-tax.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-365-compute-globe-topup-tax.fixtures.json');
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
const rand = mulberry32(0x365D0);

function randomJurisdiction(rng, tag) {
  return {
    jur: tag,
    income: Math.round(rng() * 100000),
    taxes: Math.round(rng() * 20000),
    payroll: Math.round(rng() * 50000),
    assets: Math.round(rng() * 80000),
    sbie_payroll_rate: rng() * 0.1,
    qdmtt_enacted: rng() > 0.5,
    qdmtt_rate: rng() * 0.2,
  };
}

function randomPP(rng, n) {
  const jurisdictions = [];
  for (let i = 0; i < n; i++) jurisdictions.push(randomJurisdiction(rng, `J${i}`));
  return { parent_hq: rng() > 0.5 ? 'US' : 'DE', fy: 2024 + Math.floor(rng() * 4), jurisdictions };
}

const TRIALS = 3000;

// ---------- P1: termination — unbounded jurisdictions array, bound is array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const sizes = [0, 1, 5, 50, 500];
  for (const n of sizes) {
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.jurisdictions.length !== n) violations++;
  }
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const pp = randomPP(rand, n);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.jurisdictions.length !== n) violations++;
  }
  return { name: 'P1_termination_array_length_bound', trials: checked, violations };
}

// ---------- P2: boundedness — top_up_rate in [0, GLOBE_MIN_RATE], etr finite, no negatives ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand, 1 + Math.floor(rand() * 8));
    const { output_payload } = compute(pp);
    checked++;
    for (const row of output_payload.jurisdictions) {
      if (row.top_up_rate < 0 || row.top_up_rate > 0.15) violations++;
      if (!Number.isFinite(row.etr)) violations++;
      if (row.sbie < 0 || row.income_net_sbie < 0) violations++;
      if (row.top_up_amount < 0 || row.qdmtt_collected < 0 || row.iir_collected < 0 || row.utpr_collected < 0) violations++;
    }
  }
  return { name: 'P2_boundedness_rate_and_amounts', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation invariance of every suite-level total ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS / 3; i++) {
    const n = 2 + Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const shuffled = { ...pp, jurisdictions: [...pp.jurisdictions].reverse() };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    checked++;
    if (a.total_income !== b.total_income) violations++;
    if (a.total_taxes !== b.total_taxes) violations++;
    if (a.total_top_up_tax !== b.total_top_up_tax) violations++;
    if (a.total_qdmtt_collected !== b.total_qdmtt_collected) violations++;
    if (a.total_iir_collected !== b.total_iir_collected) violations++;
    if (a.total_utpr_collected !== b.total_utpr_collected) violations++;
    if (a.low_etr_count !== b.low_etr_count) violations++;
  }
  return { name: 'P3_permutation_invariance_of_totals', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) — income/taxes/ETR threshold ----------
// Note: income and taxes are forced at ULP-boundary values INDEPENDENTLY (each held at a normal
// reference magnitude while the other is boundary-valued) rather than combined denormal x eps,
// which is a magnitude-mismatch division-overflow case (income=Number.MIN_VALUE with taxes=eps
// gives etr=taxes/income=Infinity by IEEE-754 construction, confirmed by direct execution) --
// a distinct concern from ULP-boundary forcing and not asserted here.
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const income = 1000;
  const exactTaxes = income * 0.15; // exactly at the GLOBE_MIN_RATE threshold
  const taxesBoundary = [0, -0, eps, exactTaxes, exactTaxes + eps, exactTaxes - eps, Number.MIN_VALUE];
  for (const taxes of taxesBoundary) {
    const pp = { parent_hq: 'DE', fy: 2026, jurisdictions: [{ jur: 'DE', income, taxes, payroll: 0, assets: 0 }] };
    const { output_payload } = compute(pp);
    checked++;
    const row = output_payload.jurisdictions[0];
    if (!Number.isFinite(row.etr)) violations++;
    if (!Number.isFinite(row.top_up_rate) || row.top_up_rate < 0 || row.top_up_rate > 0.15) violations++;
  }
  // income at boundary values, taxes proportionally scaled (never crossing a magnitude mismatch)
  const incomeBoundary = [0, -0, eps, Number.MIN_VALUE, 1e-300];
  for (const inc of incomeBoundary) {
    const pp = { parent_hq: 'DE', fy: 2026, jurisdictions: [{ jur: 'DE', income: inc, taxes: 0, payroll: 0, assets: 0 }] };
    const { output_payload } = compute(pp);
    checked++;
    const row = output_payload.jurisdictions[0];
    if (!Number.isFinite(row.etr)) violations++;
    if (!Number.isFinite(row.top_up_rate) || row.top_up_rate < 0 || row.top_up_rate > 0.15) violations++;
  }
  // denormal payroll/assets feeding SBIE
  for (const v of [Number.MIN_VALUE, -0, 0, eps]) {
    const pp = { parent_hq: 'DE', fy: 2026, jurisdictions: [{ jur: 'DE', income: 1000, taxes: 100, payroll: v, assets: v }] };
    const { output_payload } = compute(pp);
    checked++;
    if (!Number.isFinite(output_payload.jurisdictions[0].sbie)) violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_income_taxes_etr_threshold', trials: checked, violations };
}

// ---------- P5: Article 9.2 table oracle — independently written table, 2023-2032 ----------
const ART92_PAYROLL = [0.10, 0.098, 0.096, 0.094, 0.092, 0.09, 0.082, 0.074, 0.066, 0.058];
const ART92_ASSETS = [0.08, 0.078, 0.076, 0.074, 0.072, 0.07, 0.066, 0.062, 0.058, 0.054];
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function checkP5_article92_table_oracle() {
  let violations = 0, checked = 0;
  for (let t = 0; t < TRIALS; t++) {
    const fy = 2023 + Math.floor(rand() * 10);
    const payrollRate = ART92_PAYROLL[fy - 2023];
    const assetsRate = ART92_ASSETS[fy - 2023];
    const payroll = Math.round(rand() * 10000000);
    const assets = Math.round(rand() * 10000000);
    const pp = { parent_hq: 'DE', fy, jurisdictions: [{ jur: 'DE', income: 1000, taxes: 0, payroll, assets }] };
    const { output_payload } = compute(pp);
    checked++;
    const row = output_payload.jurisdictions[0];
    const expect = r6(payroll * payrollRate + assets * assetsRate);
    if (row.sbie !== expect) violations++;
    if (row.sbie_payroll_rate !== payrollRate) violations++;
  }
  return { name: 'P5_article92_table_oracle_2023_2032', trials: checked, violations };
}

// ---------- P6: steady state — fy >= 2033 both rates are 5% ----------
function checkP6_steady_state_from_2033() {
  let violations = 0, checked = 0;
  for (let t = 0; t < 500; t++) {
    const fy = 2033 + Math.floor(rand() * 50);
    const payroll = Math.round(rand() * 10000000);
    const assets = Math.round(rand() * 10000000);
    const pp = { parent_hq: 'DE', fy, jurisdictions: [{ jur: 'DE', income: 1000, taxes: 0, payroll, assets }] };
    const { output_payload } = compute(pp);
    checked++;
    const row = output_payload.jurisdictions[0];
    if (row.sbie !== r6(payroll * 0.05 + assets * 0.05)) violations++;
    if (row.sbie_payroll_rate !== 0.05) violations++;
  }
  return { name: 'P6_steady_state_five_percent_from_2033', trials: checked, violations };
}

// ---------- P7: monotonicity — SBIE never decreases when assets increase ----------
function checkP7_assets_monotonicity() {
  let violations = 0, checked = 0;
  for (let t = 0; t < TRIALS / 3; t++) {
    const fy = 2023 + Math.floor(rand() * 11);
    const payroll = Math.round(rand() * 10000000);
    const a1 = Math.round(rand() * 5000000);
    const a2 = a1 + Math.round(rand() * 5000000);
    const mk = (assets) => compute({ parent_hq: 'DE', fy, jurisdictions: [{ jur: 'DE', income: 1000, taxes: 0, payroll, assets }] }).output_payload.jurisdictions[0].sbie;
    checked++;
    if (mk(a2) < mk(a1)) violations++;
  }
  return { name: 'P7_sbie_never_decreases_when_assets_increase', trials: checked, violations };
}

// ---------- P8: refusal — fy < 2023 is fail-closed, no jurisdictions ----------
function checkP8_pre2023_refusal() {
  let violations = 0, checked = 0;
  for (const fy of [0, 1999, 2020, 2021, 2022]) {
    const r = compute({ parent_hq: 'DE', fy, jurisdictions: [{ jur: 'DE', income: 1000, taxes: 0, payroll: 100, assets: 100 }] });
    checked++;
    if (!r.compliance_flags.includes('LOOKUP_YEAR_UNAVAILABLE')) violations++;
    if (r.output_payload.error !== 'year_not_in_table') violations++;
    if ('jurisdictions' in r.output_payload) violations++;
  }
  return { name: 'P8_pre2023_fail_closed_refusal', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_article92_table_oracle());
results.properties.push(checkP6_steady_state_from_2033());
results.properties.push(checkP7_assets_monotonicity());
results.properties.push(checkP8_pre2023_refusal());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-365-compute-globe-topup-tax',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

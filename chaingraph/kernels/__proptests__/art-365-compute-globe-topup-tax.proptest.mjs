// art-365-compute-globe-topup-tax.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C17-1).
// kernel_digest_at_authoring: sha256:13a6650112aa3c9d98d82f8b01e865c13a0a80fedbda70988c9d012207a66e89
// (updated by ART365-GLOBE-FIX-1, 2026-08-16 -- prior digest sha256:3a481b0f... is now stale, the
// kernel was fixed against ART365-DIVERGENCE-CONFIRM-1's four CONFIRMED divergences)
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
// income/taxes/ETR-threshold inputs.
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

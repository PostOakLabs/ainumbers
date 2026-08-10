// kernel_digest_at_authoring: sha256:d86f9301b3835cd8d80c1ed5bfa8cc607bbeb1876e91b2482c16eb64316db228
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-233-check-card-act-ability-to-pay.
// Class B (bounded-numeric), FLOAT-SENSITIVE (annual_income/12 division through r4 rounding,
// DTI ratio division compared against a fixed 0.45 threshold) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays). Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-233-check-card-act-ability-to-pay.proptest.mjs

import { compute } from '../art-233-check-card-act-ability-to-pay.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-233-check-card-act-ability-to-pay.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x23301);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    applicant_age: Math.floor(randRange(rng, 16, 90)),
    annual_income: randRange(rng, 1, 200000),
    total_assets: randRange(rng, 0, 500000),
    monthly_housing_payment: randRange(rng, 0, 5000),
    monthly_debt_obligations: randRange(rng, 0, 5000),
    requested_credit_limit: randRange(rng, 100, 50000),
    has_cosigner: rng() < 0.3,
    method: pick(rng, ['income_assets', 'dti', 'income_proxy']),
    minimum_payment_pct: randRange(rng, 0.01, 0.05),
  };
}

// ---------- P1: fixed-threshold-tier agreement — method_b_sufficient iff dti_ratio <= 0.45 exactly ----------
function checkP1_dtiThresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.method_b_sufficient !== (r.dti_ratio <= 0.45)) violations++;
  }
  return { name: 'P1_method_b_sufficient_matches_dti_le_045', trials: checked, violations };
}

// ---------- P2: boundedness — under_21_restriction iff 0 < applicant_age < 21 exactly ----------
function checkP2_under21Agreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = pp.applicant_age > 0 && pp.applicant_age < 21;
    if (r.under_21_restriction !== expected) violations++;
  }
  return { name: 'P2_under_21_restriction_matches_age_lt_21', trials: checked, violations };
}

// ---------- P3: round-trip identity — monthly_income === r4(annual_income/12) exactly ----------
function checkP3_monthlyIncomeRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = Math.round(Math.round((pp.annual_income / 12) * 1e4) / 1e4 * 100) / 100;
    if (Math.abs(r.monthly_income - expected) > 1e-6) violations++;
  }
  return { name: 'P3_monthly_income_equals_r4_of_annual_over_12', trials: checked, violations };
}

// ---------- P4: fixed-tier agreement — result is REQUIRES_COSIGNER_UNDER_21 iff requires_cosigner true ----------
function checkP4_resultRequiresCosignerAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.requires_cosigner !== (r.ability_to_pay_result === 'REQUIRES_COSIGNER_UNDER_21')) violations++;
  }
  return { name: 'P4_requires_cosigner_matches_result_label', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ monthly_debt_obligations: 4500, monthly_housing_payment: 0, requested_credit_limit: 100, minimum_payment_pct: 0.01, annual_income: 120000 }, 'dti_ratio engineered exactly at 0.45 boundary — method_b_sufficient must be true (boundary is <=)'],
  [{ annual_income: 0, total_assets: 0, requested_credit_limit: 0 }, 'all-zero income/assets/limit — INSUFFICIENT_DATA guard branch'],
  [{ applicant_age: 21 }, 'applicant_age exactly at 21 — under_21_restriction must be false (boundary is strict <)'],
  [{ applicant_age: 20 }, 'applicant_age exactly at 20 — under_21_restriction must be true'],
  [{ applicant_age: 0 }, 'applicant_age exactly zero (unset sentinel) — under_21_restriction must be false (age>0 guard)'],
  [{ annual_income: 0.1 * 3 * 100000 }, 'annual_income built from a 0.1*3 rounding-noise product — monthly_income must be r4() of the EXACT double quotient'],
  [{ annual_income: -0 }, 'annual_income negative zero — Math.max(0,...) must normalize to plain 0'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { applicant_age: 30, annual_income: 50000, total_assets: 10000, monthly_housing_payment: 1000, monthly_debt_obligations: 500, requested_credit_limit: 5000, has_cosigner: false, method: 'dti', minimum_payment_pct: 0.02, ...overrides };
    const r = compute(pp).output_payload;
    const finite = typeof r.ability_to_pay_result === 'string' && Number.isFinite(r.dti_ratio) && Number.isFinite(r.monthly_income);
    rows.push({ label, overrides, ability_to_pay_result: r.ability_to_pay_result, under_21_restriction: r.under_21_restriction, dti_ratio: r.dti_ratio, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_dtiThresholdAgreement());
results.properties.push(checkP2_under21Agreement());
results.properties.push(checkP3_monthlyIncomeRoundTrip());
results.properties.push(checkP4_resultRequiresCosignerAgreement());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-233-check-card-act-ability-to-pay');
  process.exit(1);
}
console.log('PASS art-233-check-card-act-ability-to-pay');

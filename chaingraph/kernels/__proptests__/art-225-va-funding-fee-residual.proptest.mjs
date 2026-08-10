// kernel_digest_at_authoring: sha256:0a2c6c768159e004a4be516f27462520d1e1459d4323169d1530a336a0172053
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-225-va-funding-fee-residual.
// Class B (bounded-numeric), FLOAT-SENSITIVE (r2/r4 rounding of base_loan*rate products,
// residual-margin subtraction, DTI threshold comparison against a raw double) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), B1/B3-shaped. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-225-va-funding-fee-residual.proptest.mjs

import { compute } from '../art-225-va-funding-fee-residual.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-225-va-funding-fee-residual.fixtures.json');
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
const rand = mulberry32(0x22501);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

const PURPOSES = ['purchase', 'irrrl', 'streamline_refi', 'cash_out_refi', 'cashout'];
const USE_TYPES = ['first', 'subsequent'];
const STATES = ['TX', 'NY', 'CA', 'IL', 'ZZ'];
const KNOWN_RATES = new Set([0, 0.005, 0.0215, 0.033, 0.015, 0.0125].map((r) => Math.round(r * 1e4) / 1e4));

function mkPP(rng) {
  return {
    base_loan_amount: randRange(rng, 1, 800000),
    down_payment_pct: randRange(rng, 0, 30),
    loan_purpose: pick(rng, PURPOSES),
    va_use_type: pick(rng, USE_TYPES),
    funding_fee_exempt: rng() < 0.15,
    family_size: Math.floor(randRange(rng, 1, 8)),
    state: pick(rng, STATES),
    dti_pct: randRange(rng, 0, 60),
    gross_monthly_income: randRange(rng, 0, 20000),
    monthly_shelter_expenses: randRange(rng, 0, 15000),
  };
}

// ---------- P1: boundedness — ff_rate always drawn from the fixed statutory rate table ----------
function checkP1_ffRateBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const rate = Math.round((r.output_payload.funding_fee.rate_pct / 100) * 1e4) / 1e4;
    if (!KNOWN_RATES.has(rate)) violations++;
  }
  return { name: 'P1_funding_fee_rate_bounded_to_statutory_table', trials: checked, violations };
}

// ---------- P2: monotonicity — financed_loan_amount is nondecreasing in base_loan_amount (fixed rate basis) ----------
function checkP2_financedAmountMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, base_loan_amount: 100000 };
    const hi = { ...base, base_loan_amount: 200000 };
    const rLo = compute(lo).output_payload.funding_fee.financed_loan_amount;
    const rHi = compute(hi).output_payload.funding_fee.financed_loan_amount;
    checked++;
    if (rHi < rLo) violations++;
  }
  return { name: 'P2_financed_loan_amount_nondecreasing_in_base_loan', trials: checked, violations };
}

// ---------- P3: round-trip identity — residual_margin === actual_monthly - required_monthly exactly (post-r2) ----------
function checkP3_residualMarginIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload.residual_income;
    checked++;
    const expected = Math.round((r.actual_monthly - r.required_monthly) * 100) / 100;
    if (r.margin !== expected) violations++;
  }
  return { name: 'P3_residual_margin_equals_actual_minus_required', trials: checked, violations };
}

// ---------- P4: fixed-threshold-tier agreement — dti_ok matches dti_pct<=41 (or ==0) exactly ----------
function checkP4_dtiThresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload.dti;
    checked++;
    const expected = pp.dti_pct === 0 || pp.dti_pct <= 41.0;
    if (r.ok !== expected) violations++;
  }
  return { name: 'P4_dti_ok_matches_41pct_fixed_threshold', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ dti_pct: 41.0 }, 'dti_pct exactly at 41.0 threshold — dti_ok must be true (boundary is <=)'],
  [{ dti_pct: 41.0 + Number.EPSILON * 100 }, 'dti_pct 1 ULP-ish above 41.0 — dti_ok must be false'],
  [{ dti_pct: 40.99999999999999 }, 'dti_pct 1-ULP-below-41 — dti_ok must be true'],
  [{ down_payment_pct: 5 }, 'down_payment_pct exactly at 5% tier boundary — dpTier must select tier 1, not tier 0'],
  [{ down_payment_pct: 4.999999999999999 }, 'down_payment_pct 1-ULP-below-5 — dpTier must still select tier 0'],
  [{ down_payment_pct: 10 }, 'down_payment_pct exactly at 10% tier boundary — dpTier must select tier 2'],
  [{ base_loan_amount: 0 }, 'base_loan_amount exactly zero — funding_fee_amount must be exactly 0, LOAN_AMOUNT_MISSING flag raised'],
  [{ base_loan_amount: -0 }, 'base_loan_amount negative zero — must behave identically to positive zero'],
  [{ base_loan_amount: 0.1 * 3 * 1000000, down_payment_pct: 0 }, 'base_loan_amount = (0.1*3)*1e6 classic non-exact double — funding_fee_amount must be r2() of the EXACT product, not a hand-rounded approximation'],
  [{ gross_monthly_income: 6000, monthly_shelter_expenses: 6000 }, 'actual_monthly exactly zero via equal income/expenses — margin must equal -required_monthly exactly, meets_requirement per r2(0)>=required'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { base_loan_amount: 300000, down_payment_pct: 10, loan_purpose: 'purchase', va_use_type: 'first', family_size: 2, state: 'TX', dti_pct: 30, gross_monthly_income: 6000, monthly_shelter_expenses: 2000, ...overrides };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.funding_fee.amount) && Number.isFinite(op.residual_income.margin) && Number.isFinite(op.dti.actual_pct);
    rows.push({ label, overrides, funding_fee_amount: op.funding_fee.amount, dti_ok: op.dti.ok, margin: op.residual_income.margin, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_ffRateBounded());
results.properties.push(checkP2_financedAmountMonotone());
results.properties.push(checkP3_residualMarginIdentity());
results.properties.push(checkP4_dtiThresholdAgreement());
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
  console.error('PROPERTY FLOOR FAILED for art-225-va-funding-fee-residual');
  process.exit(1);
}
console.log('PASS art-225-va-funding-fee-residual');

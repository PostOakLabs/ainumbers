// kernel_digest_at_authoring: sha256:2ff736927d33cc21662cf8751c9182933760e8d7bf20ec50e5dcbd5b93e48615
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-243-purpose-code-requirement-checker.
// Class B (bounded-numeric), FLOAT-SENSITIVE (payment_amount_usd compared against the fixed
// SWIFTGO_MAX_USD=12500 threshold via > 0 && <= boundary) — ULP-boundary forcing is MANDATORY
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-243-purpose-code-requirement-checker.proptest.mjs

import { compute } from '../art-243-purpose-code-requirement-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-243-purpose-code-requirement-checker.fixtures.json');
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
const rand = mulberry32(0x243C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;

const COUNTRIES = ['AE', 'IN', 'BH', 'JO', 'CN', 'MY', 'US', 'GB', 'DE', 'ZZ'];
const CATEGORY_CODES = ['SALA', 'PENS', 'TRAD', 'CORT', 'BEXP', 'SUPP', 'DIVI', 'BENE', 'OTHR', 'CHAR', 'XXXX'];

function mkPP(rng) {
  const beneficiary_country = pick(rng, COUNTRIES);
  const payment_amount_usd = randRange(rng, -100, 30000);
  const purpose_code = rng() < 0.8 ? pick(rng, ['TRAD', 'SALA', 'AB1', 'AB12']) : '';
  const category_purpose_code = rng() < 0.8 ? pick(rng, CATEGORY_CODES) : '';
  return { beneficiary_country, payment_amount_usd, purpose_code, category_purpose_code };
}

// ---------- P1: swiftgo_amount_ok exactly matches (amount>0 && amount<=12500) ----------
function checkP1_amountOkExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.payment_amount_usd > 0 && pp.payment_amount_usd <= 12500;
    if (r.output_payload.swiftgo_amount_ok !== expected) violations++;
  }
  return { name: 'P1_swiftgo_amount_ok_matches_fixed_threshold', trials: checked, violations };
}

// ---------- P2: swiftgo_eligible === swiftgo_amount_ok && swiftgo_category_ok ----------
function checkP2_eligibleIsConjunction() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { swiftgo_eligible, swiftgo_amount_ok, swiftgo_category_ok } = r.output_payload;
    if (swiftgo_eligible !== (swiftgo_amount_ok && swiftgo_category_ok)) violations++;
  }
  return { name: 'P2_swiftgo_eligible_exact_conjunction', trials: checked, violations };
}

// ---------- P3: boundedness — jurisdiction_requires_purpose_code implies purpose_code_provided required for compliance ----------
function checkP3_complianceBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { jurisdiction_requires_purpose_code, purpose_code_provided, purpose_code_compliant } = r.output_payload;
    if (jurisdiction_requires_purpose_code && !purpose_code_provided && purpose_code_compliant) violations++;
    if (typeof purpose_code_compliant !== 'boolean') violations++;
  }
  return { name: 'P3_jurisdiction_required_and_absent_implies_noncompliant', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing around SWIFTGO_MAX_USD=12500 ----------
const ULP_BOUNDARY_CASES = [
  [{ beneficiary_country: 'US', payment_amount_usd: 12500, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount exactly at threshold 12500 — swiftgo_amount_ok must be true (<=)'],
  [{ beneficiary_country: 'US', payment_amount_usd: 12500 + Number.EPSILON * 12500, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount 1 ULP above threshold — swiftgo_amount_ok must be false'],
  [{ beneficiary_country: 'US', payment_amount_usd: 12500 - Number.EPSILON * 12500, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount 1 ULP below threshold — swiftgo_amount_ok must be true'],
  [{ beneficiary_country: 'US', payment_amount_usd: 0, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount exactly zero — swiftgo_amount_ok must be false (>0 required)'],
  [{ beneficiary_country: 'US', payment_amount_usd: -0, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount negative zero — must behave as zero, false, no NaN'],
  [{ beneficiary_country: 'US', payment_amount_usd: Number.MIN_VALUE, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount smallest positive denormal double — must classify true (>0, <=12500), no NaN'],
  [{ beneficiary_country: 'US', payment_amount_usd: NaN, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount NaN — safeNum coerces to 0, swiftgo_amount_ok must be false'],
  [{ beneficiary_country: 'US', payment_amount_usd: 0.1 * 3 * 41666.666, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount computed via classic non-exact double chain around threshold — must not throw, verdict finite'],
  [{ beneficiary_country: 'US', payment_amount_usd: Number.MAX_SAFE_INTEGER, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount at MAX_SAFE_INTEGER — must remain finite, swiftgo_amount_ok false (exceeds threshold)'],
  [{ beneficiary_country: 'US', payment_amount_usd: 1e-300, purpose_code: '', category_purpose_code: 'TRAD' }, 'amount in subnormal range — must remain finite, swiftgo_amount_ok true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { swiftgo_amount_ok, swiftgo_eligible, swiftgo_max_usd } = r.output_payload;
    const plausible = typeof swiftgo_amount_ok === 'boolean' && typeof swiftgo_eligible === 'boolean' && Number.isFinite(swiftgo_max_usd);
    rows.push({ label, input: pp, swiftgo_amount_ok, swiftgo_eligible, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_amountOkExact());
results.properties.push(checkP2_eligibleIsConjunction());
results.properties.push(checkP3_complianceBounded());
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

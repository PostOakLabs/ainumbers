// kernel_digest_at_authoring: sha256:7c47eb66621889efcbc72476358adf9d81118f0c4692dc01375cb7251f1ada8e
//
// FV-PROPFLOOR-SHARD-B24-1 — property-test floor for art-447-securitization-risk-retention-check.
// Class B (bounded-numeric), FLOAT-SENSITIVE (retained/total exposure amounts feed a percentage
// division compared against a fixed 5% threshold) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-447-securitization-risk-retention-check.proptest.mjs

import { compute } from '../art-447-securitization-risk-retention-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-447-securitization-risk-retention-check.fixtures.json');
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
const rand = mulberry32(0x447C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const METHODS = ['vertical_slice', 'horizontal_first_loss', 'l_shaped', 'representative_sample', 'sellers_interest'];

function mkPP(rng) {
  const jurisdiction = rng() < 0.5 ? 'us' : 'eu';
  const total = randRange(rng, 1, 1e6);
  const retained = randRange(rng, 0, total * 1.5);
  return {
    jurisdiction, retention_method: pick(rng, METHODS),
    total_securitized_exposure_musd: total, retained_amount_musd: retained,
    all_exposures_qrm_qualified: jurisdiction === 'us' && rng() < 0.3,
    retainer_is_sole_purpose_entity: rng() < 0.1,
    retained_interest_hedged_or_sold: rng() < 0.1,
  };
}

// ---------- P1: fixed-threshold-tier agreement — compliant is exact AND of all breach checks negated ----------
function checkP1_compliantAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const meetsThreshold = r.required_retention_pct === 0 || (r.actual_retention_pct !== null && r.actual_retention_pct >= r.required_retention_pct);
    const expectedCompliant = r.retention_method_valid && meetsThreshold && !r.retainer_is_sole_purpose_entity && !r.retained_interest_hedged_or_sold;
    if (r.compliant !== expectedCompliant) violations++;
    if (r.compliant !== (r.breach_reasons.length === 0)) violations++;
  }
  return { name: 'P1_compliant_exact_agreement_with_all_checks', trials: checked, violations };
}

// ---------- P2: monotonicity — increasing retained_amount_musd (holding exposure fixed) never decreases actual_retention_pct ----------
function checkP2_retentionMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.total_securitized_exposure_musd <= 0) continue;
    const r1 = compute(pp).output_payload;
    const pp2 = { ...pp, retained_amount_musd: pp.retained_amount_musd + randRange(rand, 0.01, 100) };
    const r2v = compute(pp2).output_payload;
    checked++;
    if (r2v.actual_retention_pct < r1.actual_retention_pct) violations++;
  }
  return { name: 'P2_actual_retention_pct_nondecreasing_in_retained_amount', trials: checked, violations };
}

// ---------- P3: boundedness — actual_retention_pct is null iff total exposure is exactly zero, else finite ----------
function checkP3_retentionPctBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const isZeroExposure = r.total_securitized_exposure_musd === 0;
    if (isZeroExposure && r.actual_retention_pct !== null) violations++;
    if (!isZeroExposure && (r.actual_retention_pct === null || !Number.isFinite(r.actual_retention_pct))) violations++;
  }
  return { name: 'P3_actual_retention_pct_null_iff_zero_exposure_else_finite', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const BASE = { jurisdiction: 'eu', retention_method: 'vertical_slice', total_securitized_exposure_musd: 100, retained_amount_musd: 5 };
const ULP_BOUNDARY_CASES = [
  [{ ...BASE, retained_amount_musd: 5 }, 'actual retention exactly 5% (required) — compliant must be true (>=, not >)'],
  [{ ...BASE, retained_amount_musd: 5 - Number.EPSILON * 5 }, 'actual retention 1 ULP-scale below 5% — must flip to noncompliant'],
  [{ ...BASE, total_securitized_exposure_musd: 0, retained_amount_musd: 0 }, 'both exposure and retained exactly zero — actual_retention_pct must be null, not NaN'],
  [{ ...BASE, total_securitized_exposure_musd: -0, retained_amount_musd: 0 }, 'negative zero exposure — Math.max(0,...) clamps, treated as zero'],
  [{ ...BASE, total_securitized_exposure_musd: Number.MIN_VALUE, retained_amount_musd: Number.MIN_VALUE }, 'smallest positive doubles for both — ratio finite, non-NaN'],
  [{ ...BASE, total_securitized_exposure_musd: 1e15, retained_amount_musd: 5e13 }, 'large-scale exposure at 1e15 — no overflow to Infinity'],
  [{ ...BASE, total_securitized_exposure_musd: 3, retained_amount_musd: 0.1 }, '0.1/3*100 classic non-exact double rounding artifact'],
  [{ jurisdiction: 'us', retention_method: 'vertical_slice', total_securitized_exposure_musd: 100, retained_amount_musd: 0, all_exposures_qrm_qualified: true }, 'US QRM exemption — required_retention_pct must be exactly 0, zero retention still compliant'],
  [{ ...BASE, retention_method: 'not_a_real_method' }, 'invalid retention_method string — retention_method_valid false, INVALID_RETENTION_METHOD breach'],
  [{ ...BASE, retained_amount_musd: -100 }, 'negative retained_amount_musd — Math.max(0,...) clamps to zero, no NaN'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = typeof r.compliant === 'boolean' && (r.actual_retention_pct === null || Number.isFinite(r.actual_retention_pct));
    rows.push({ label, actual_retention_pct: r.actual_retention_pct, compliant: r.compliant, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_compliantAgreement());
results.properties.push(checkP2_retentionMonotone());
results.properties.push(checkP3_retentionPctBounded());
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

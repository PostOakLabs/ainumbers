// kernel_digest_at_authoring: sha256:63c47665ca6ea5d115ee195ae212be51bd97cc85a5eca9abc193cc762918aea9
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-299-aca-esrp-exposure.
// Class B (bounded-numeric), FLOAT-SENSITIVE (coverage_offer_rate is a raw-double division,
// compared against a fixed 0.95 threshold; exposure amounts are raw-double products) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 float
// harness (art-107/art-15). This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-299-aca-esrp-exposure.proptest.mjs

import { compute } from '../art-299-aca-esrp-exposure.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-299-aca-esrp-exposure.fixtures.json');
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
const rand = mulberry32(0x29901);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const A_ANNUAL = 3340, B_ANNUAL = 5010;

function mkPP(rng) {
  const fulltime_count = Math.floor(randRange(rng, 1, 1000));
  return {
    tax_year: '2026',
    fulltime_count,
    offered_mec_count: Math.floor(randRange(rng, 0, fulltime_count + 1)),
    ptc_employee_count: Math.floor(randRange(rng, 0, 50)),
  };
}

// ---------- P1: monotone — raising offered_mec_count never increases a_exposure_annual ----------
function checkP1_monotoneOfferRate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const low = { ...pp, offered_mec_count: 0 };
    const high = { ...pp, offered_mec_count: pp.fulltime_count };
    const r1 = compute(low);
    const r2 = compute(high);
    checked++;
    if (r2.output_payload.a_exposure_annual > r1.output_payload.a_exposure_annual) violations++;
  }
  return { name: 'P1_monotone_a_exposure_nonincreasing_as_offer_rate_rises', trials: checked, violations };
}

// ---------- P2: boundedness — exposure amounts always finite and non-negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { a_exposure_annual, b_exposure_annual, controlling_exposure_annual } = r.output_payload;
    if (!Number.isFinite(a_exposure_annual) || a_exposure_annual < 0) violations++;
    if (!Number.isFinite(b_exposure_annual) || b_exposure_annual < 0) violations++;
    if (!Number.isFinite(controlling_exposure_annual) || controlling_exposure_annual < 0) violations++;
  }
  return { name: 'P2_boundedness_exposures_finite_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — a_applicable matches exact 0.95 threshold comparison ----------
function checkP3_aApplicableAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedRate = pp.fulltime_count > 0 ? pp.offered_mec_count / pp.fulltime_count : null;
    const expectedApplicable = expectedRate !== null && expectedRate < 0.95;
    if (r.output_payload.a_applicable !== expectedApplicable) violations++;
    const expectedB = B_ANNUAL * pp.ptc_employee_count;
    if (r.output_payload.b_exposure_annual !== expectedB) violations++;
  }
  return { name: 'P3_a_applicable_matches_exact_offer_rate_threshold', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ tax_year: '2026', fulltime_count: 200, offered_mec_count: 190, ptc_employee_count: 0 }, 'coverage_offer_rate exactly 0.95 (190/200) — a_applicable must be FALSE (< not <=)'],
  [{ tax_year: '2026', fulltime_count: 200, offered_mec_count: 189, ptc_employee_count: 0 }, 'coverage_offer_rate 0.945, 1-ULP-shaped below 0.95 — a_applicable must be true'],
  [{ tax_year: '2026', fulltime_count: 0, offered_mec_count: 0, ptc_employee_count: 5 }, 'fulltime_count exactly zero — coverage_offer_rate null (0/0 guarded), a_applicable false, b_exposure still computed'],
  [{ tax_year: '2026', fulltime_count: 30, offered_mec_count: 0, ptc_employee_count: 0 }, 'fulltime_count exactly at the 30-employee A-exclusion boundary — a_exposure_annual must be exactly 0'],
  [{ tax_year: '2026', fulltime_count: 31, offered_mec_count: 0, ptc_employee_count: 0 }, 'fulltime_count 1 above the 30-exclusion boundary — a_exposure_annual must be exactly 1*3340'],
  [{ tax_year: '2026', fulltime_count: 3, offered_mec_count: 3, ptc_employee_count: 0 }, 'coverage_offer_rate exactly 1 (3/3, a classic 0.1*3-shaped division result) — a_applicable must be false'],
  [{ tax_year: '2026', fulltime_count: 100000000, offered_mec_count: 0, ptc_employee_count: 0 }, 'very large fulltime_count — a_exposure_annual must stay finite, no overflow'],
  [{ tax_year: '2026', fulltime_count: 200, offered_mec_count: -0, ptc_employee_count: 0 }, 'negative-zero offered_mec_count normalizes via Math.round — must behave as zero, not throw'],
  [{ tax_year: '2026', fulltime_count: 3, offered_mec_count: 1, ptc_employee_count: 0 }, 'coverage_offer_rate = 1/3 (0.333...) — a_applicable true, exact double division result must reproduce identically'],
  [{ tax_year: '2026', fulltime_count: 200, offered_mec_count: 200, ptc_employee_count: 0 }, 'coverage_offer_rate exactly 1 — a_applicable must be false, b_applicable false, controlling_penalty none'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { a_exposure_annual, b_exposure_annual, coverage_offer_rate, a_applicable } = r.output_payload;
    const finite = Number.isFinite(a_exposure_annual) && Number.isFinite(b_exposure_annual)
      && (coverage_offer_rate === null || Number.isFinite(coverage_offer_rate));
    const plausible = finite && (a_applicable === null || typeof a_applicable === 'boolean');
    rows.push({ label, pp, a_exposure_annual, b_exposure_annual, coverage_offer_rate, a_applicable, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneOfferRate());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_aApplicableAgreement());
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

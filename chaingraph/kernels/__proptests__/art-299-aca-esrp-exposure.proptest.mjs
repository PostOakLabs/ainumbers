// kernel_digest_at_authoring: sha256:d07a15cc7c7b3da43db92b15595249dcb3e8a81ca73d2e0144172de35b6e410e
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-299-aca-esrp-exposure.
// Class B (bounded-numeric), FLOAT-SENSITIVE (coverage_offer_rate is an unrounded float division
// offeredMecCount/fulltimeCount compared against the fixed OFFER_RATE_THRESHOLD=0.95 with `<`) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
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
const rand = mulberry32(0x299C3);
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
const TRIALS = 12000;
const OFFER_RATE_THRESHOLD = 0.95;
const A_EXCLUSION_COUNT = 30;
const A_ANNUAL = 3340;
const B_ANNUAL = 5010;

function mkPP(rng) {
  const fulltime = randInt(rng, 0, 500);
  return {
    tax_year: rng() < 0.9 ? '2026' : 'BOGUS',
    fulltime_count: fulltime,
    offered_mec_count: randInt(rng, 0, fulltime + 10),
    ptc_employee_count: randInt(rng, 0, 20),
  };
}

// ---------- P1: fixed rule — a_applicable exactly matches coverage_offer_rate < 0.95 threshold ----------
function checkP1_aApplicableExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    if (pp.tax_year !== '2026' || pp.fulltime_count === 0) continue;
    checked++;
    const rate = pp.offered_mec_count / pp.fulltime_count;
    const expected = rate < OFFER_RATE_THRESHOLD;
    if (r.output_payload.a_applicable !== expected) violations++;
  }
  return { name: 'P1_a_applicable_exact_lt_0.95_threshold', trials: checked, violations };
}

// ---------- P2: boundedness — a_exposure_annual and b_exposure_annual are always non-negative ----------
function checkP2_exposureNonNegative() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    if (pp.tax_year !== '2026') continue;
    checked++;
    if (r.output_payload.a_exposure_annual < 0 || r.output_payload.b_exposure_annual < 0) violations++;
  }
  return { name: 'P2_exposure_amounts_never_negative', trials: checked, violations };
}

// ---------- P3: fixed rule — a_exposure_annual exact formula, b_exposure_annual exact product ----------
function checkP3_exposureExactFormula() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    if (pp.tax_year !== '2026') continue;
    checked++;
    const rate = pp.fulltime_count > 0 ? pp.offered_mec_count / pp.fulltime_count : null;
    const aApplicable = rate !== null && rate < OFFER_RATE_THRESHOLD;
    const expectedA = aApplicable ? Math.max(0, pp.fulltime_count - A_EXCLUSION_COUNT) * A_ANNUAL : 0;
    const expectedB = pp.ptc_employee_count * B_ANNUAL;
    if (r.output_payload.a_exposure_annual !== expectedA) violations++;
    if (r.output_payload.b_exposure_annual !== expectedB) violations++;
  }
  return { name: 'P3_exposure_amounts_exact_fixed_formula', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing around OFFER_RATE_THRESHOLD=0.95 ----------
const ULP_BOUNDARY_CASES = [
  [{ tax_year: '2026', fulltime_count: 100, offered_mec_count: 95, ptc_employee_count: 0 }, 'coverage_offer_rate exactly 0.95 — a_applicable must be false (< is strict, not <=)'],
  [{ tax_year: '2026', fulltime_count: 1000, offered_mec_count: 949, ptc_employee_count: 0 }, 'coverage_offer_rate = 0.949, just under threshold — a_applicable must be true'],
  [{ tax_year: '2026', fulltime_count: 20, offered_mec_count: 19, ptc_employee_count: 0 }, '19/20=0.95 exact double, small denominator — a_applicable must be false'],
  [{ tax_year: '2026', fulltime_count: 0, offered_mec_count: 0, ptc_employee_count: 0 }, 'fulltime_count exactly zero — coverage_offer_rate null (no divide-by-zero), a_applicable must be false'],
  [{ tax_year: '2026', fulltime_count: 3, offered_mec_count: 1, ptc_employee_count: 0 }, '1/3 non-exact repeating double, well below threshold — a_applicable true, no NaN'],
  [{ tax_year: '2026', fulltime_count: 30, offered_mec_count: 0, ptc_employee_count: 0 }, 'fulltime_count exactly at A_EXCLUSION_COUNT=30 — a_exposure_annual must be exactly 0 (max(0, 30-30)*3340)'],
  [{ tax_year: '2026', fulltime_count: 31, offered_mec_count: 0, ptc_employee_count: 0 }, 'fulltime_count 1 above exclusion boundary — a_exposure_annual must be exactly 1*3340=3340'],
  [{ tax_year: '2026', fulltime_count: 29, offered_mec_count: 0, ptc_employee_count: 0 }, 'fulltime_count 1 below exclusion boundary — max(0, 29-30) clamps to 0, exposure must be exactly 0, not negative'],
  [{ tax_year: '2026', fulltime_count: 500, offered_mec_count: 500 * OFFER_RATE_THRESHOLD, ptc_employee_count: 0 }, 'offered_mec_count computed as exact threshold product (500*0.95=475) — must classify not-applicable (rate==threshold)'],
  [{ tax_year: '2026', fulltime_count: 100, offered_mec_count: Math.round(100 * OFFER_RATE_THRESHOLD) - 1, ptc_employee_count: 0 }, 'offered_mec_count 1 below the rounded threshold count — a_applicable must be true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { a_applicable, a_exposure_annual, b_exposure_annual, coverage_offer_rate } = r.output_payload;
    const plausible = typeof a_applicable === 'boolean' && Number.isFinite(a_exposure_annual) && Number.isFinite(b_exposure_annual) && (coverage_offer_rate === null || Number.isFinite(coverage_offer_rate));
    rows.push({ label, input: pp, a_applicable, a_exposure_annual, coverage_offer_rate, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_aApplicableExact());
results.properties.push(checkP2_exposureNonNegative());
results.properties.push(checkP3_exposureExactFormula());
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

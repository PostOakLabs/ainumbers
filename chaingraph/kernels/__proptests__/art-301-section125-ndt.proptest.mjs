// kernel_digest_at_authoring: sha256:88e54dc6a5136721213a32c5acbcb0563bf120ad2af4e3f8e9f58caadc9665da
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-301-section125-ndt.
// Class B (bounded-numeric), FLOAT-SENSITIVE (eligibility/benefits/concentration ratios are all
// raw-double divisions compared against fixed 0.70/1.0/0.25 thresholds) — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2/B3 float harness (art-107/art-15). This file
// is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-301-section125-ndt.proptest.mjs

import { compute } from '../art-301-section125-ndt.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-301-section125-ndt.fixtures.json');
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
const rand = mulberry32(0x30101);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const nhceTotal = Math.floor(randRange(rng, 1, 500));
  const hceTotal = Math.floor(randRange(rng, 1, 100));
  return {
    nhce_eligible_count: Math.floor(randRange(rng, 0, nhceTotal + 1)),
    nhce_total_count: nhceTotal,
    hce_eligible_count: Math.floor(randRange(rng, 0, hceTotal + 1)),
    hce_total_count: hceTotal,
    nhce_avg_benefit_pct: randRange(rng, 0, 0.2),
    hce_avg_benefit_pct: randRange(rng, 0.001, 0.2),
    key_employee_elected_total: randRange(rng, 0, 50000),
    total_elected_all_participants: randRange(rng, 1, 100000),
  };
}

// ---------- P1: monotone — raising key_employee_elected_total never turns concentration_pass false→true ----------
function checkP1_monotoneConcentration() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const low = { ...pp, key_employee_elected_total: 0 };
    const high = { ...pp, key_employee_elected_total: pp.total_elected_all_participants };
    const r1 = compute(low);
    const r2 = compute(high);
    checked++;
    if (r1.output_payload.concentration.pass === false && r2.output_payload.concentration.pass === true) violations++;
  }
  return { name: 'P1_monotone_concentration_pass_nonincreasing_as_key_share_rises', trials: checked, violations };
}

// ---------- P2: boundedness — all three ratios, when computed, are finite non-negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { eligibility, concentration } = r.output_payload;
    if (eligibility.ratio !== null && (!Number.isFinite(eligibility.ratio) || eligibility.ratio < 0)) violations++;
    if (!Number.isFinite(concentration.concentration_ratio) || concentration.concentration_ratio < 0) violations++;
  }
  return { name: 'P2_boundedness_ratios_finite_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — concentration_pass matches exact <= 0.25 comparison ----------
function checkP3_concentrationAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedRatio = pp.key_employee_elected_total / pp.total_elected_all_participants;
    const expectedPass = expectedRatio <= 0.25;
    if (r.output_payload.concentration.pass !== expectedPass) violations++;
    const expectedAllPass = r.output_payload.eligibility.pass === true && r.output_payload.benefits.pass === true && expectedPass === true;
    if (r.output_payload.all_tests_pass !== expectedAllPass) violations++;
  }
  return { name: 'P3_concentration_pass_matches_exact_025_threshold', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ nhce_eligible_count: 25, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.05, hce_avg_benefit_pct: 0.05, key_employee_elected_total: 25000, total_elected_all_participants: 100000 }, 'concentration_ratio exactly 0.25 (25000/100000) — pass must be TRUE (<=, not <)'],
  [{ nhce_eligible_count: 25, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.05, hce_avg_benefit_pct: 0.05, key_employee_elected_total: 25000.00000000001, total_elected_all_participants: 100000 }, '1-ULP above the exact 0.25 boundary — pass must be false'],
  [{ nhce_eligible_count: 70, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.05, hce_avg_benefit_pct: 0.05, key_employee_elected_total: 0, total_elected_all_participants: 100000 }, 'eligibility_ratio exactly 0.70 (70/100 over 100/100=1) — pass must be true'],
  [{ nhce_eligible_count: 0, nhce_total_count: 100, hce_eligible_count: 0, hce_total_count: 100, nhce_avg_benefit_pct: 0, hce_avg_benefit_pct: 0.001, key_employee_elected_total: 0, total_elected_all_participants: 1 }, 'nhce_eligible_count zero, hce_eligibility_rate zero denominator-safe — eligibility_ratio must handle 0/0-shaped edge without NaN'],
  [{ nhce_eligible_count: 100, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.055, hce_avg_benefit_pct: 0.055, key_employee_elected_total: 0, total_elected_all_participants: 1 }, 'benefits_ratio exactly 1.0 via equal doubles — pass must be true (>=, not >)'],
  [{ nhce_eligible_count: 100, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.1 * 3, hce_avg_benefit_pct: 0.3, key_employee_elected_total: 0, total_elected_all_participants: 1 }, 'nhce_avg_benefit_pct = 0.1*3 (classic non-exact double) vs hce 0.3 exactly — ratio must reflect the EXACT double comparison, not a rounded 1.0'],
  [{ nhce_eligible_count: 1, nhce_total_count: 3, hce_eligible_count: 1, hce_total_count: 3, nhce_avg_benefit_pct: 0.05, hce_avg_benefit_pct: 0.05, key_employee_elected_total: 1, total_elected_all_participants: 3 }, 'concentration_ratio = 1/3 (repeating double) — must reproduce identically, pass false'],
  [{ nhce_eligible_count: 100, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.05, hce_avg_benefit_pct: 0.05, key_employee_elected_total: Number.MAX_SAFE_INTEGER, total_elected_all_participants: Number.MAX_SAFE_INTEGER }, 'key_elected and total both at MAX_SAFE_INTEGER — ratio must stay exactly 1, pass false, no overflow'],
  [{ nhce_eligible_count: 100, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: Number.MIN_VALUE, hce_avg_benefit_pct: 0.05, key_employee_elected_total: 0, total_elected_all_participants: 1 }, 'nhce_avg_benefit_pct smallest positive double — benefits_ratio near-zero, finite, pass false'],
  [{ nhce_eligible_count: 100, nhce_total_count: 100, hce_eligible_count: 100, hce_total_count: 100, nhce_avg_benefit_pct: 0.05, hce_avg_benefit_pct: 0.05, key_employee_elected_total: -0, total_elected_all_participants: 1 }, 'negative-zero key_employee_elected_total — must behave as zero, concentration_ratio exactly 0, pass true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { eligibility, benefits, concentration } = r.output_payload;
    const finite = (eligibility.ratio === null || Number.isFinite(eligibility.ratio))
      && (benefits.ratio === null || Number.isFinite(benefits.ratio))
      && Number.isFinite(concentration.concentration_ratio);
    const plausible = finite;
    rows.push({ label, pp, eligibility, benefits, concentration, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneConcentration());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_concentrationAgreement());
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

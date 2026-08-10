// kernel_digest_at_authoring: sha256:510689cdacc57d0934a872451735f41f2e58e4b71158ca7acf61f3738a74936b
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-338-compute-federal-withholding.
// Class B (bounded-numeric), FLOAT-SENSITIVE — bracket math divides/rounds dollar
// amounts across a piecewise-linear schedule — ULP-boundary forcing at bracket
// edges is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-338-compute-federal-withholding.proptest.mjs

import { compute } from '../art-338-compute-federal-withholding.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-338-compute-federal-withholding.fixtures.json');
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
const rand = mulberry32(0x338F81);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;
const PAY_FREQS = ['daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'semiannually'];
const FILING = ['single_or_mfs', 'married_filing_jointly', 'head_of_household'];

function mkPP(rng) {
  return {
    gross_wages_per_period: randRange(rng, 0, 20000),
    pay_frequency: pick(rng, PAY_FREQS),
    filing_status: pick(rng, FILING),
    step3_dependents_credit_annual: randRange(rng, 0, 5000),
    step4a_other_income_annual: randRange(rng, 0, 20000),
    step4b_deductions_annual: randRange(rng, 0, 20000),
    step4c_extra_withholding_per_period: randRange(rng, 0, 500),
  };
}

// ---------- P1: monotonicity — federal_withholding_per_period non-decreasing in gross_wages_per_period ----------
function checkP1_monotonicInGrossWages() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const lo = compute(pp).output_payload;
    const hi = compute({ ...pp, gross_wages_per_period: pp.gross_wages_per_period + 200 }).output_payload;
    if (hi.federal_withholding_per_period < lo.federal_withholding_per_period - 0.02) violations++;
  }
  return { name: 'P1_withholding_monotonic_nondecreasing_in_gross_wages', trials: checked, violations };
}

// ---------- P2: boundedness — withholding never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    if (r.federal_withholding_per_period < 0) violations++;
    if (r.bracket_rate < 0 || r.bracket_rate > 0.37) violations++;
  }
  return { name: 'P2_withholding_nonnegative_and_bracket_rate_in_range', trials: checked, violations };
}

// ---------- P3: bracket-boundary agreement — at an exact bracket floor, tentative annual withholding equals base_tax ----------
function checkP3_bracketFloorAgreement() {
  let violations = 0, checked = 0;
  const BRACKET_FLOORS_SINGLE = [6400, 18325, 54875, 109750, 203700, 256925, 632750];
  for (const floor of BRACKET_FLOORS_SINGLE) {
    checked++;
    // Craft gross wages so adjusted_annual_wage_amount lands exactly on the floor:
    // line1e - line1h = floor, with periodsPerYear=1 not permitted (weekly=52 chosen), so
    // gross_wages_per_period * 52 = floor + 8600 (backout amount, single/mfs, no other adjustments).
    const backout = 8600;
    const grossAnnual = floor + backout;
    const pp = {
      gross_wages_per_period: grossAnnual / 52,
      pay_frequency: 'weekly',
      filing_status: 'single_or_mfs',
      step3_dependents_credit_annual: 0,
      step4a_other_income_annual: 0,
      step4b_deductions_annual: 0,
      step4c_extra_withholding_per_period: 0,
    };
    const r = compute(pp).output_payload;
    if (Math.abs(r.adjusted_annual_wage_amount - floor) > 0.02) violations++;
    if (Math.abs(r.bracket_at_least - floor) > 0.02) violations++;
  }
  return { name: 'P3_bracket_floor_boundary_agreement', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ gross_wages_per_period: 0, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'gross_wages_per_period exactly zero — WITHHOLDING_ZERO_WAGES flag, withholding must be 0'],
  [{ gross_wages_per_period: -0, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'gross_wages_per_period negative zero — Math.max(0,...) clamps identically to positive zero'],
  [{ gross_wages_per_period: Number.MIN_VALUE, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'gross_wages_per_period at smallest denormal — must remain finite, near-zero withholding'],
  [{ gross_wages_per_period: -100, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'negative gross_wages_per_period — Math.max(0,...) clamps to zero, no negative withholding'],
  [{ gross_wages_per_period: 1000000, pay_frequency: 'annually_unused', filing_status: 'single_or_mfs' }, 'invalid pay_frequency falls back to biweekly default — must not throw, must resolve a valid periods_per_year'],
  [{ gross_wages_per_period: 100000, pay_frequency: 'daily', filing_status: 'married_filing_jointly' }, 'top marginal bracket (37%) reached via daily frequency (260 periods/yr) — TOP_MARGINAL_BRACKET flag, withholding finite'],
  [{ gross_wages_per_period: (18325 + 8600) / 26, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'adjusted annual wage amount crafted to land exactly on the 18325 bracket floor via biweekly (26 periods) — must resolve to the 12% bracket, not 10%'],
  [{ gross_wages_per_period: 0.1 * 3 * 10000, pay_frequency: 'weekly', filing_status: 'head_of_household' }, 'gross_wages_per_period = (0.1*3)*10000, a repeating-decimal double close to but not exactly 3000 — x/y*y!==x class case, must resolve cleanly'],
  [{ gross_wages_per_period: 5000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs', step4b_deductions_annual: 1e9 }, 'step4b_deductions_annual astronomically large — adjusted_annual_wage_amount clamps to 0 via Math.max(0,...), withholding must be 0, no negative bracket lookup'],
  [{ gross_wages_per_period: 5000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs', step4c_extra_withholding_per_period: 1e9 }, 'step4c extra withholding astronomically large — added straight through, must remain finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = [r.federal_withholding_per_period, r.adjusted_annual_wage_amount, r.bracket_rate].every(Number.isFinite) && r.federal_withholding_per_period >= 0;
    rows.push({ label, input: pp, federal_withholding_per_period: r.federal_withholding_per_period, adjusted_annual_wage_amount: r.adjusted_annual_wage_amount, bracket_at_least: r.bracket_at_least, bracket_rate: r.bracket_rate, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotonicInGrossWages());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_bracketFloorAgreement());
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

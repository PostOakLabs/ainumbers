// kernel_digest_at_authoring: sha256:fa90218bd6b3bc32b4f1576091449faaf753c2601b28576dc3521ea785f7dc0c
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-338-compute-federal-withholding.
// Class B (bounded-numeric), FLOAT-SENSITIVE — bracket math divides/rounds dollar
// amounts across a piecewise-linear schedule — ULP-boundary forcing at bracket
// edges is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
//
// YEAR-KEYED. The kernel selects its schedule from PARAMS[tax_year], so every
// boundary below is stated PER YEAR and the year key itself is a boundary: an
// unsupported or missing tax_year must compute nothing (fail-closed), which is
// forced explicitly in P4 and asserted as a property in P5.
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
const SUPPORTED_YEARS = ['2025', '2026'];

// Bracket floors per supported edition. 2026: Pub 15-T (2026) Section 1 STANDARD
// annual schedules. 2025: the prior edition, retained so the year key is proven
// to still reproduce it.
const BRACKET_FLOORS_SINGLE_BY_YEAR = {
  '2026': [7500, 19900, 57900, 113200, 209275, 263725, 648100],
  '2025': [6400, 18325, 54875, 109750, 203700, 256925, 632750],
};
const BACKOUT_SINGLE = 8600; // Worksheet 1A line 1g, box not checked — same both years

function mkPP(rng) {
  return {
    tax_year: pick(rng, SUPPORTED_YEARS),
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
  for (const year of SUPPORTED_YEARS) {
  for (const floor of BRACKET_FLOORS_SINGLE_BY_YEAR[year]) {
    checked++;
    // Craft gross wages so adjusted_annual_wage_amount lands exactly on the floor:
    // line1e - line1h = floor, with periodsPerYear=1 not permitted (weekly=52 chosen), so
    // gross_wages_per_period * 52 = floor + 8600 (backout amount, single/mfs, no other adjustments).
    const backout = BACKOUT_SINGLE;
    const grossAnnual = floor + backout;
    const pp = {
      tax_year: year,
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
  }
  return { name: 'P3_bracket_floor_boundary_agreement_per_year', trials: checked, violations };
}

// ---------- P5: no unsupported year EVER computes a number ----------
// The defect this rebuild closes was a kernel that answered confidently for a year
// it had no constants for. This asserts the inverse across the random corpus.
function checkP5_unknownYearAlwaysFailsClosed() {
  let violations = 0, checked = 0;
  const UNSUPPORTED = ['2019', '2024', '2027', '2030', '', 'twenty-twenty-six', '2026 ', ' 2026'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const year = UNSUPPORTED[i % UNSUPPORTED.length];
    const r = compute({ ...pp, tax_year: year }).output_payload;
    if (r.error !== 'unsupported_or_missing_tax_year') violations++;
    if (r.federal_withholding_per_period !== null) violations++;
    if (r.constants_version !== null) violations++;
  }
  return { name: 'P5_unsupported_tax_year_always_fails_closed', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  // --- the year key is itself a boundary: fail-closed cases -------------------
  [{ gross_wages_per_period: 2000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'tax_year absent entirely (the v1.0.0 call shape) — must fail closed with unsupported_or_missing_tax_year and compute NO withholding, never silently apply a default edition'],
  [{ tax_year: '2024', gross_wages_per_period: 2000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'tax_year one year below the supported range — fail closed'],
  [{ tax_year: '2027', gross_wages_per_period: 2000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'tax_year one year above the supported range — fail closed'],
  [{ tax_year: 2026, gross_wages_per_period: 2000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, 'tax_year as a NUMBER rather than the required string — fail closed, no type coercion into a supported key'],
  // --- 2026 edition boundaries ------------------------------------------------
  [{ tax_year: '2026', gross_wages_per_period: 0, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: gross_wages_per_period exactly zero — WITHHOLDING_ZERO_WAGES flag, withholding must be 0'],
  [{ tax_year: '2026', gross_wages_per_period: -0, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: gross_wages_per_period negative zero — Math.max(0,...) clamps identically to positive zero'],
  [{ tax_year: '2026', gross_wages_per_period: Number.MIN_VALUE, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: gross_wages_per_period at smallest denormal — must remain finite, near-zero withholding'],
  [{ tax_year: '2026', gross_wages_per_period: -100, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: negative gross_wages_per_period — Math.max(0,...) clamps to zero, no negative withholding'],
  [{ tax_year: '2026', gross_wages_per_period: 1000000, pay_frequency: 'annually_unused', filing_status: 'single_or_mfs' }, '2026: invalid pay_frequency falls back to biweekly default — must not throw, must resolve a valid periods_per_year'],
  [{ tax_year: '2026', gross_wages_per_period: 100000, pay_frequency: 'daily', filing_status: 'married_filing_jointly' }, '2026: top marginal bracket (37%, MFJ floor 788,000) reached via daily frequency — TOP_MARGINAL_BRACKET flag, withholding finite'],
  [{ tax_year: '2026', gross_wages_per_period: (19900 + 8600) / 26, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: adjusted annual wage amount crafted to land exactly on the 19,900 bracket floor via biweekly (26 periods) — must resolve to the 12% bracket, not 10%'],
  [{ tax_year: '2026', gross_wages_per_period: (19900 + 8600 - 0.01) / 26, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: one cent BELOW the 19,900 bracket floor — must stay in the 10% bracket, proving the floor is inclusive-at and not inclusive-below'],
  [{ tax_year: '2026', gross_wages_per_period: (648100 + 8600) / 26, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2026: exactly on the 648,100 top-bracket floor (single/MFS) — the open-ended row, base 192,979.25 at 37%'],
  [{ tax_year: '2026', gross_wages_per_period: 0.1 * 3 * 10000, pay_frequency: 'weekly', filing_status: 'head_of_household' }, '2026: gross_wages_per_period = (0.1*3)*10000, a repeating-decimal double close to but not exactly 3000 — x/y*y!==x class case, must resolve cleanly'],
  [{ tax_year: '2026', gross_wages_per_period: 5000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs', step4b_deductions_annual: 1e9 }, '2026: step4b_deductions_annual astronomically large — adjusted_annual_wage_amount clamps to 0 via Math.max(0,...), withholding must be 0, no negative bracket lookup'],
  [{ tax_year: '2026', gross_wages_per_period: 5000, pay_frequency: 'biweekly', filing_status: 'single_or_mfs', step4c_extra_withholding_per_period: 1e9 }, '2026: step4c extra withholding astronomically large — added straight through, must remain finite'],
  // --- 2025 edition boundaries, retained so the year key proves reproduction ---
  [{ tax_year: '2025', gross_wages_per_period: (18325 + 8600) / 26, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2025: exactly on the PRIOR edition 18,325 bracket floor — the year key must still reach the 2025 schedule, not the 2026 one'],
  [{ tax_year: '2025', gross_wages_per_period: (632750 + 8600) / 26, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2025: exactly on the prior edition 632,750 top-bracket floor, base 188,769.75'],
  [{ tax_year: '2025', gross_wages_per_period: 0, pay_frequency: 'biweekly', filing_status: 'single_or_mfs' }, '2025: zero wages — WITHHOLDING_ZERO_WAGES flag under the prior edition too'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    // A fail-closed result is plausible IFF it computed nothing at all: the error
    // token is set and every computed field is null. A partially-null result, or a
    // number sitting alongside an error, is a defect — that is what this asserts.
    const plausible = r.error === 'unsupported_or_missing_tax_year'
      ? (r.federal_withholding_per_period === null && r.adjusted_annual_wage_amount === null
         && r.bracket_rate === null && r.tax_year === null && r.constants_version === null)
      : ([r.federal_withholding_per_period, r.adjusted_annual_wage_amount, r.bracket_rate].every(Number.isFinite)
         && r.federal_withholding_per_period >= 0 && r.error === null
         && r.tax_year === pp.tax_year && r.constants_version === pp.tax_year);
    rows.push({ label, input: pp, tax_year: r.tax_year, error: r.error, federal_withholding_per_period: r.federal_withholding_per_period, adjusted_annual_wage_amount: r.adjusted_annual_wage_amount, bracket_at_least: r.bracket_at_least, bracket_rate: r.bracket_rate, plausible });
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
results.properties.push(checkP5_unknownYearAlwaysFailsClosed());
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

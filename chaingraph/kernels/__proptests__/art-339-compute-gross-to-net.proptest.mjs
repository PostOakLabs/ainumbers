// kernel_digest_at_authoring: sha256:884e9783d26552ef06435b323571abcc4f1cecc3b10648477fa0291b39dab877
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-339-compute-gross-to-net.
// Class B (bounded-numeric), FLOAT-SENSITIVE — FICA wage-base and Additional
// Medicare threshold math divides/clamps dollar amounts at cutoffs — ULP-boundary
// forcing at those cutoffs is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies.
//
// YEAR-KEYED. The OASDI contribution and benefit base is selected from
// PARAMS[tax_year] — $176,100 for 2025, $184,500 for 2026 — so the wage-base
// boundary is forced PER YEAR below rather than at one fossilized figure. The
// $200,000 Additional Medicare threshold is statutory and NOT indexed, so it
// stays a single cutoff. The year key is itself a boundary: an unsupported or
// missing tax_year must compute nothing, forced in P4 and asserted in P5.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-339-compute-gross-to-net.proptest.mjs

import { compute } from '../art-339-compute-gross-to-net.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-339-compute-gross-to-net.fixtures.json');
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
const rand = mulberry32(0x339971);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

// SSA Contribution and Benefit Base per supported year. These are the values the
// kernel's PARAMS carry; the properties below assert against them independently
// rather than reading the figure back out of the payload under test.
const SS_WAGE_BASE_BY_YEAR = { '2025': 176100, '2026': 184500 };
const SUPPORTED_YEARS = Object.keys(SS_WAGE_BASE_BY_YEAR);
const ADDITIONAL_MEDICARE_THRESHOLD = 200000; // statutory, not indexed, not year-keyed

function mkPP(rng) {
  const gross = randRange(rng, 0, 15000);
  const pretax = randRange(rng, 0, gross * 0.3);
  return {
    tax_year: pick(rng, SUPPORTED_YEARS),
    gross_wages_per_period: gross,
    federal_withholding_per_period: randRange(rng, 0, gross * 0.3),
    pretax_reduces_fica_and_fit: pretax,
    post_tax_other_deductions: randRange(rng, 0, gross * 0.1),
    ytd_fica_wages_before_period: randRange(rng, 0, 250000),
  };
}

// ---------- P1: monotonicity — net_pay non-increasing in post_tax_other_deductions ----------
function checkP1_netPayMonotonicInDeductions() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const lo = compute(pp).output_payload;
    const hi = compute({ ...pp, post_tax_other_deductions: pp.post_tax_other_deductions + 100 }).output_payload;
    if (hi.net_pay > lo.net_pay + 0.02 && lo.net_pay > 0) violations++;
  }
  return { name: 'P1_net_pay_nonincreasing_in_post_tax_deductions', trials: checked, violations };
}

// ---------- P2: boundedness — FICA components nonnegative, SS taxable wages never exceed room remaining or FICA wages ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    if ([r.social_security_tax, r.medicare_tax, r.additional_medicare_tax].some((v) => v < 0)) violations++;
    if (r.ss_taxable_wages_this_period > r.fica_wages_this_period + 0.02) violations++;
    // Independent derivation (SO #34): the expected base comes from the per-year
    // table above, NOT from r.ss_wage_base, which is the value under test.
    const expectedBase = SS_WAGE_BASE_BY_YEAR[pp.tax_year];
    if (r.ss_wage_base !== expectedBase) violations++;
    const ssRoomRemaining = Math.max(0, Math.round((expectedBase - pp.ytd_fica_wages_before_period) * 100) / 100);
    if (r.ss_taxable_wages_this_period > ssRoomRemaining + 0.02) violations++;
  }
  return { name: 'P2_fica_components_nonnegative_and_ss_taxable_bounded', trials: checked, violations };
}

// ---------- P3: metamorphic — once YTD is past the SS wage base, no further SS tax accrues ----------
function checkP3_ssCapEnforced() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const base = SS_WAGE_BASE_BY_YEAR[pp.tax_year];
    const past = { ...pp, ytd_fica_wages_before_period: base + randRange(rand, 0, 100000) };
    const r = compute(past).output_payload;
    if (r.social_security_tax > 1e-6) violations++;
    // The converse is the actual defect this rebuild closes: strictly BELOW that
    // year's base, with wages to spare, SS tax must be strictly positive. A kernel
    // fossilized on a prior year's base returns zero here for the newer year.
    const below = { ...pp, gross_wages_per_period: 5000, pretax_reduces_fica_and_fit: 0,
      ytd_fica_wages_before_period: base - 4500 };
    const rb = compute(below).output_payload;
    if (!(rb.social_security_tax > 0)) violations++;
  }
  return { name: 'P3_ss_cap_enforced_at_that_years_base_and_not_before', trials: checked, violations };
}

// ---------- P5: no unsupported year EVER computes a number ----------
// The defect this rebuild closes was a kernel that answered confidently for a year
// it had no wage base for. This asserts the inverse across the random corpus.
function checkP5_unknownYearAlwaysFailsClosed() {
  let violations = 0, checked = 0;
  const UNSUPPORTED = ['2019', '2024', '2027', '2030', '', 'twenty-twenty-six', '2026 ', ' 2026'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute({ ...pp, tax_year: UNSUPPORTED[i % UNSUPPORTED.length] }).output_payload;
    if (r.error !== 'unsupported_or_missing_tax_year') violations++;
    if (r.social_security_tax !== null) violations++;
    if (r.ss_wage_base !== null) violations++;
    if (r.net_pay !== null) violations++;
  }
  return { name: 'P5_unsupported_tax_year_always_fails_closed', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
/** @type {Array<[Record<string, any>, string]>} */
const ULP_BOUNDARY_CASES = [
  // --- the year key is itself a boundary: fail-closed cases -------------------
  [{ gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 180000 }, 'tax_year absent entirely (the v1.0.0 call shape, which silently applied the 2025 base) — must fail closed with unsupported_or_missing_tax_year and compute NOTHING'],
  [{ tax_year: '2024', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 180000 }, 'tax_year below the supported range — fail closed, no extrapolated wage base'],
  [{ tax_year: '2027', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 180000 }, 'tax_year above the supported range — fail closed; the next COLA is not guessable and must not be guessed'],
  [{ tax_year: 2026, gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 180000 }, 'tax_year as a NUMBER rather than the required string — fail closed, no type coercion into a supported key'],
  // --- 2026 OASDI wage base $184,500 — at, one cent below, one cent above -----
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 184500 }, '2026: YTD exactly at the $184,500 SS wage base — SS_WAGE_BASE_REACHED, ss_taxable_wages_this_period must be exactly 0'],
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 184499.99 }, '2026: YTD one cent below the $184,500 base — ss_taxable_wages_this_period must be exactly 0.01, not the full period wages'],
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 184500.01 }, '2026: YTD one cent above the $184,500 base — no SS tax at all'],
  [{ tax_year: '2026', gross_wages_per_period: 5000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 180000 }, '2026: YTD $180,000 — INSIDE the $176,100-$184,500 band this rebuild closes. Against the 2025 base this returned $0.00; against the 2026 base $4,500 is taxable and SS tax must be $279.00'],
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 176100 }, '2026: YTD exactly at the PRIOR year base $176,100 — under the 2026 schedule this is NOT a boundary at all and the full period must be SS-taxable. This is the case a fossilized kernel gets wrong'],
  // --- 2025 OASDI wage base $176,100 — retained so the year key proves reproduction
  [{ tax_year: '2025', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 176100 }, '2025: YTD exactly at the $176,100 base — SS_WAGE_BASE_REACHED, ss_taxable_wages_this_period exactly 0, reproducing the prior year exactly'],
  [{ tax_year: '2025', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 176099.99 }, '2025: YTD one cent below the $176,100 base — ss_taxable_wages_this_period must be exactly 0.01'],
  [{ tax_year: '2025', gross_wages_per_period: 5000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 180000 }, '2025: the same $180,000 YTD fact pattern — correctly $0.00 SS tax for 2025, proving the fix did not simply move the fossil forward'],
  // --- $200,000 Additional Medicare threshold — statutory, not year-keyed -----
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 200000 }, '2026: YTD exactly at the $200,000 Additional Medicare threshold — ADDITIONAL_MEDICARE_APPLIED, all this-period wages surtaxed'],
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 199999.99 }, '2026: YTD one cent below the $200,000 threshold — only the excess over the threshold is surtaxed'],
  [{ tax_year: '2025', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 200000 }, '2025: the $200,000 threshold is identical under the prior year — it is statutory and not indexed'],
  // --- float/clamp edges, unchanged in kind --------------------------------
  [{ tax_year: '2026', gross_wages_per_period: 0, federal_withholding_per_period: 0, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, '2026: gross_wages_per_period exactly zero — GROSS_TO_NET_ZERO_WAGES flag, net_pay must be 0'],
  [{ tax_year: '2026', gross_wages_per_period: -0, federal_withholding_per_period: 0, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, '2026: gross_wages_per_period negative zero — Math.max(0,...) clamps identically to positive zero'],
  [{ tax_year: '2026', gross_wages_per_period: Number.MIN_VALUE, federal_withholding_per_period: 0, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, '2026: gross_wages_per_period at smallest denormal — must remain finite, near-zero FICA'],
  [{ tax_year: '2026', gross_wages_per_period: 0.1 * 3 * 10000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, '2026: gross_wages_per_period = (0.1*3)*10000, a repeating-decimal double close to but not exactly 3000 — x/y*y!==x class case, must round cleanly'],
  [{ tax_year: '2026', gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 1e9, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, '2026: pretax_reduces_fica_and_fit astronomically large (exceeds gross) — fica_wages_this_period clamps to 0 via Math.max(0,...), no negative FICA wage base'],
  [{ tax_year: '2026', gross_wages_per_period: 500, federal_withholding_per_period: 400, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 400, ytd_fica_wages_before_period: 0 }, '2026: deductions exceeding gross wages — net_pay must clamp to 0 (NET_PAY_NEGATIVE flag), never negative in output'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    // A fail-closed result is plausible IFF it computed nothing at all. A number
    // sitting alongside an error token is the defect, not a pass.
    const plausible = r.error === 'unsupported_or_missing_tax_year'
      ? (r.net_pay === null && r.social_security_tax === null && r.ss_wage_base === null
         && r.tax_year === null && r.constants_version === null)
      : ([r.net_pay, r.social_security_tax, r.medicare_tax, r.additional_medicare_tax].every(Number.isFinite)
         && r.net_pay >= 0 && r.error === null
         && r.ss_wage_base === SS_WAGE_BASE_BY_YEAR[pp.tax_year]
         && r.additional_medicare_threshold === ADDITIONAL_MEDICARE_THRESHOLD);
    rows.push({ label, input: pp, tax_year: r.tax_year, error: r.error, ss_wage_base: r.ss_wage_base, net_pay: r.net_pay, social_security_tax: r.social_security_tax, medicare_tax: r.medicare_tax, additional_medicare_tax: r.additional_medicare_tax, ss_taxable_wages_this_period: r.ss_taxable_wages_this_period, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_netPayMonotonicInDeductions());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_ssCapEnforced());
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

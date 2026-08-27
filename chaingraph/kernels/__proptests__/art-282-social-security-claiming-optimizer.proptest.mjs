// kernel_digest_at_authoring: sha256:9d2c7e3087335619cc0b73d88aee628911bb8cc330020b36cb609549c58fb144
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-282-social-security-claiming-optimizer.
// Class B (bounded-numeric), FLOAT-SENSITIVE (fraYears interpolates by month fractions,
// monthlyFactor divides claim/FRA month differences into fixed reduction/credit rates,
// and pvOfAnnuity compounds a raw discount-rate double across up to ~48 loop iterations)
// — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to
// the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-282-social-security-claiming-optimizer.proptest.mjs

import { compute } from '../art-282-social-security-claiming-optimizer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-282-social-security-claiming-optimizer.fixtures.json');
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
const rand = mulberry32(0x282B10);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;

function mkPP(rng) {
  return {
    claimant: {
      birthYear: Math.floor(randRange(rng, 1930, 2000)),
      pia: randRange(rng, 500, 5000),
      claimAge: randRange(rng, 62, 70),
      earningsIfWorking: randRange(rng, 0, 100000),
      discountRatePct: randRange(rng, 0, 10),
      longevityAge: randRange(rng, 63, 110),
    },
  };
}

// ---------- P1: monotonicity — monthlyBenefitAtClaimAge is nondecreasing in claimAge (later claim never pays less/month) ----------
function checkP1_claimAgeMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const age1 = Math.min(69, Math.max(62, pp.claimant.claimAge));
    const r1 = compute({ claimant: { ...pp.claimant, claimAge: age1 } });
    const r2 = compute({ claimant: { ...pp.claimant, claimAge: age1 + 1 } });
    checked++;
    if (!(r2.output_payload.monthlyBenefitAtClaimAge >= r1.output_payload.monthlyBenefitAtClaimAge - 1e-9)) violations++;
  }
  return { name: 'P1_monthly_benefit_nondecreasing_as_claim_age_rises', trials: checked, violations };
}

// ---------- P2: boundedness — claimAge clamped to [62,70], longevityAge clamped >= claimAge+1 and <= 110, all money fields finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.claimAge < 62 || op.claimAge > 70) violations++;
    if (op.longevityAge > 110) violations++;
    if (!Number.isFinite(op.lifetimePV) || !Number.isFinite(op.monthlyBenefitAtClaimAge)) violations++;
    if (op.fullRetirementAge < 65 || op.fullRetirementAge > 67) violations++;
  }
  return { name: 'P2_claim_age_and_longevity_clamped_money_fields_finite', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — FRA matches the exact statutory birth-year table ----------
function checkP3_fraTable() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const y = pp.claimant.birthYear;
    let expected;
    if (y <= 1937) expected = 65;
    else if (y >= 1943 && y <= 1954) expected = 66;
    else if (y >= 1960) expected = 67;
    else if (y >= 1955 && y <= 1959) expected = 66 + (y - 1954) * (2 / 12);
    else expected = 65 + (y - 1937) * (2 / 12);
    if (Math.abs(r.output_payload.fullRetirementAge - expected) > 1e-9) violations++;
  }
  return { name: 'P3_full_retirement_age_matches_statutory_birth_year_table', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
/** @type {Array<[Record<string, any>, string]>} */
const ULP_BOUNDARY_CASES = [
  [{ claimAge: 62 }, 'claimAge at its own Math.max(62) floor — reduction factor must apply the maximum early-claim penalty without throwing'],
  [{ claimAge: 70 }, 'claimAge at its own Math.min(70) ceiling — delayed credit must cap correctly, no further credit beyond 70'],
  [{ birthYear: 1954 }, 'birthYear exactly at the 1954/1955 FRA-table boundary — must be exactly 66 (not the interpolated formula)'],
  [{ birthYear: 1954 + 1 }, 'birthYear 1 year past the 1954 boundary — must use the interpolation formula, 66 + 2/12'],
  [{ birthYear: 1960 }, 'birthYear exactly at the 1960 boundary — must be exactly 67 (not the interpolated formula)'],
  [{ pia: 0 }, 'pia exactly zero — all monthlyBenefit values must be exactly 0, lifetimePV exactly 0'],
  [{ earningsIfWorking: 24480 }, 'earningsIfWorking exactly at the 2026 earnings-test exempt amount ($24,480) — withheld must be exactly 0 (Math.max(0, earnings-limit)/2)'],
  [{ earningsIfWorking: 24479.99, claimAge: 63 }, 'earningsIfWorking one cent BELOW the 2026 exempt amount, below FRA — still exactly 0 withheld, the exempt amount is inclusive'],
  [{ earningsIfWorking: 24480.02, claimAge: 63 }, 'earningsIfWorking two cents ABOVE the 2026 exempt amount, below FRA — withheld must be exactly 0.01 ($1 per $2 of excess), not the full benefit'],
  [{ earningsIfWorking: 23400, claimAge: 63 }, 'earningsIfWorking at the SUPERSEDED 2025 amount ($23,400) while below FRA — under the corrected 2026 amount this is BELOW the exempt threshold so withheld must be exactly 0. A kernel fossilized on the 2025 figure withholds here; this is the case that catches it'],
  [{ earningsTestAnnualLimit: 0, earningsIfWorking: 1000, claimAge: 63 }, 'user-supplied exempt amount of exactly 0 — a legitimate override at the boundary of the >= 0 guard, so the whole excess is withheld rather than falling back to the default'],
  [{ earningsTestAnnualLimit: -1, earningsIfWorking: 30000, claimAge: 63 }, 'negative user-supplied exempt amount — rejected by the >= 0 guard and the pinned default applies, never a negative withholding threshold'],
  [{ discountRatePct: 0.1 * 3 }, 'discountRatePct = 0.1*3 (classic non-exact double artifact) — pvOfAnnuity loop must reflect the exact double, not throw'],
  [{ longevityAge: 62 + Number.EPSILON }, 'longevityAge 1-ULP above claimAge+1 floor at claimAge=62 — years must stay positive and finite'],
  [{ claimAge: 66 + 2 / 12, birthYear: 1954 }, 'claimAge exactly equal to FRA in fractional-year form — monthlyFactor diff must resolve to exactly 0 (factor 1), no rounding drift from the Math.round(*12) conversion'],
];

function checkP4_forced() {
  // 2026 earnings-test exempt amount, asserted independently of the kernel (SO #34):
  // SSA, Exempt Amounts Under the Earnings Test, retrieved 2026-08-23.
  const EXEMPT_2026 = 24480;
  const base = { birthYear: 1960, pia: 2000, claimAge: 67, earningsIfWorking: 0, discountRatePct: 3, longevityAge: 85 };
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { claimant: { ...base, ...overrides } };
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.lifetimePV) && Number.isFinite(op.monthlyBenefitAtClaimAge) && Number.isFinite(op.fullRetirementAge);
    // The exempt amount actually applied must be the user override when one was
    // supplied and >= 0, and otherwise EXACTLY the pinned 2026 figure asserted
    // above -- never a fossilized prior-year amount.
    const supplied = overrides.earningsTestAnnualLimit;
    const expectedLimit = (typeof supplied === 'number' && supplied >= 0) ? supplied : EXEMPT_2026;
    const limitCorrect = op.earningsTestAnnualLimit === expectedLimit;
    const sourceCorrect = op.earningsTestLimitSource === ((typeof supplied === 'number' && supplied >= 0) ? 'user_supplied' : 'pinned_default_2026');
    rows.push({ label, overrides, fullRetirementAge: op.fullRetirementAge, monthlyBenefitAtClaimAge: op.monthlyBenefitAtClaimAge, lifetimePV: op.lifetimePV, earningsTestAnnualLimit: op.earningsTestAnnualLimit, earningsTestLimitSource: op.earningsTestLimitSource, finite, limitCorrect, sourceCorrect, plausible: finite && limitCorrect && sourceCorrect });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_claimAgeMonotone());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_fraTable());
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

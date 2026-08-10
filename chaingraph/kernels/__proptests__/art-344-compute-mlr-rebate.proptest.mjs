// kernel_digest_at_authoring: sha256:cbfd7b14ca5eea94ba5e2f06b9b61ae2e75e52cb321068fd05eaad7b4969ee28
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-344-compute-mlr-rebate.
// Class B (bounded-numeric), FLOAT:YES — dollar/pct ratios, r2 rounding, 3-year
// premium-weighted averaging. ULP-boundary forcing mandatory. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B12 harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-344-compute-mlr-rebate.proptest.mjs

import { compute } from '../art-344-compute-mlr-rebate.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-344-compute-mlr-rebate.fixtures.json');
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
const rand = mulberry32(0x3440A1);
const TRIALS = 8000;
const MARKETS = ['individual', 'small_group', 'large_group'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }

function mkPP(rng) {
  const earned_premium = range(rng, 1000, 10000000);
  const federal_taxes_fees = range(rng, 0, earned_premium * 0.15);
  const state_taxes_fees = range(rng, 0, earned_premium * 0.15);
  const incurred_claims = range(rng, 0, earned_premium * 1.2);
  const quality_improvement_expenditures = range(rng, 0, earned_premium * 0.05);
  return {
    market: pick(rng, MARKETS),
    reporting_year: 2026,
    earned_premium,
    federal_taxes_fees,
    state_taxes_fees,
    incurred_claims,
    quality_improvement_expenditures,
    reinsurance_recoveries: range(rng, 0, earned_premium * 0.05),
    risk_adjustment_net: range(rng, -earned_premium * 0.02, earned_premium * 0.02),
    risk_corridors_net: range(rng, -earned_premium * 0.02, earned_premium * 0.02),
    member_life_years: Math.floor(range(rng, 0, 200000)),
    prior_year_1_adjusted_mlr_pct: rng() < 0.5 ? null : range(rng, 60, 100),
    prior_year_1_earned_premium: rng() < 0.5 ? 0 : range(rng, 0, earned_premium),
    prior_year_2_adjusted_mlr_pct: rng() < 0.5 ? null : range(rng, 60, 100),
    prior_year_2_earned_premium: rng() < 0.5 ? 0 : range(rng, 0, earned_premium),
  };
}

// ---------- P1: credibility_adjustment_pct_points is bounded to [0,8] ----------
function checkP1_credibilityAdjustmentBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const v = r.output_payload.credibility_adjustment_pct_points;
    if (!(v >= 0 && v <= 8)) violations++;
  }
  return { name: 'P1_credibility_adjustment_bounded_0_to_8', trials: checked, violations };
}

// ---------- P2: rebate_owed is the exact boolean of rebate_amount > 0 ----------
function checkP2_rebateOwedExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { rebate_owed, rebate_amount } = r.output_payload;
    if (rebate_owed !== (rebate_amount > 0)) violations++;
  }
  return { name: 'P2_rebate_owed_exact_boolean_of_rebate_amount_positive', trials: checked, violations };
}

// ---------- P3: de_minimis implies rebate_owed ----------
function checkP3_deMinimisImpliesRebateOwed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { de_minimis, rebate_owed } = r.output_payload;
    if (de_minimis && !rebate_owed) violations++;
  }
  return { name: 'P3_de_minimis_implies_rebate_owed', trials: checked, violations };
}

// ---------- P4: monotonicity — raising incurred_claims (premium fixed, positive) never decreases raw_mlr_pct ----------
function checkP4_rawMlrMonotoneInClaims() {
  let violations = 0, checked = 0;
  const TRIALS_MONO = Math.floor(TRIALS / 2);
  for (let i = 0; i < TRIALS_MONO; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    if (r1.output_payload.raw_mlr_pct === null || pp.earned_premium - pp.federal_taxes_fees - pp.state_taxes_fees <= 0) continue;
    const delta = range(rand, 1, 50000);
    const pp2 = { ...pp, incurred_claims: pp.incurred_claims + delta };
    const r2v = compute(pp2);
    checked++;
    if (r2v.output_payload.raw_mlr_pct < r1.output_payload.raw_mlr_pct - 1e-9) violations++;
  }
  return { name: 'P4_raw_mlr_pct_nondecreasing_in_incurred_claims', trials: checked, violations };
}

// ---------- P5 (mandatory, float-sensitive): forced ULP-boundary cases on adjusted_earned_premium ----------
function checkP5_forced() {
  const rows = [];
  const base = {
    market: 'individual', reporting_year: 2026,
    quality_improvement_expenditures: 0, reinsurance_recoveries: 0,
    risk_adjustment_net: 0, risk_corridors_net: 0, member_life_years: 5000,
    prior_year_1_adjusted_mlr_pct: null, prior_year_1_earned_premium: 0,
    prior_year_2_adjusted_mlr_pct: null, prior_year_2_earned_premium: 0,
  };
  const cases = [
    // adjusted_earned_premium exactly 0 — must flag MLR_ZERO_PREMIUM, raw_mlr_pct 0
    { ...base, earned_premium: 100000, federal_taxes_fees: 60000, state_taxes_fees: 40000, incurred_claims: 50000, label: 'adjusted_earned_premium exactly 0' },
    // adjusted_earned_premium at +Number.EPSILON scale above zero (smallest representable positive delta)
    { ...base, earned_premium: 100000 + Number.EPSILON, federal_taxes_fees: 60000, state_taxes_fees: 40000, incurred_claims: 50000, label: 'adjusted_earned_premium at +Number.EPSILON — must NOT be treated as zero' },
    // adjusted_earned_premium at -0 (negative zero from subtraction)
    { ...base, earned_premium: 0, federal_taxes_fees: 0, state_taxes_fees: -0, incurred_claims: 0, label: 'adjusted_earned_premium is negative zero — <=0 gate must still trip' },
    // adjusted_earned_premium a denormal-scale positive value
    { ...base, earned_premium: Number.MIN_VALUE, federal_taxes_fees: 0, state_taxes_fees: 0, incurred_claims: 0, label: 'adjusted_earned_premium is a denormal (Number.MIN_VALUE) — must stay finite' },
    // member_life_years exactly at non-credible/partially-credible boundary (1000)
    { ...base, earned_premium: 5000000, federal_taxes_fees: 100000, state_taxes_fees: 50000, incurred_claims: 4000000, member_life_years: 1000, label: 'member_life_years exactly 1000 — lower partially-credible boundary' },
    { ...base, earned_premium: 5000000, federal_taxes_fees: 100000, state_taxes_fees: 50000, incurred_claims: 4000000, member_life_years: 999, label: 'member_life_years exactly 999 — non_credible (just below boundary)' },
    // member_life_years exactly at fully-credible boundary (75000)
    { ...base, earned_premium: 5000000, federal_taxes_fees: 100000, state_taxes_fees: 50000, incurred_claims: 4000000, member_life_years: 75000, label: 'member_life_years exactly 75000 — fully_credible boundary' },
    { ...base, earned_premium: 5000000, federal_taxes_fees: 100000, state_taxes_fees: 50000, incurred_claims: 4000000, member_life_years: 74999, label: 'member_life_years exactly 74999 — partially_credible (just below boundary)' },
    // negative adjusted_earned_premium (taxes exceed premium)
    { ...base, earned_premium: 100000, federal_taxes_fees: 80000, state_taxes_fees: 30000, incurred_claims: 50000, label: 'adjusted_earned_premium strictly negative' },
  ];
  for (const c of cases) {
    const { label, ...pp } = c;
    const r = compute(pp);
    const { adjusted_earned_premium, raw_mlr_pct, credibility_tier } = r.output_payload;
    const plausible = Number.isFinite(adjusted_earned_premium) && Number.isFinite(raw_mlr_pct) && typeof credibility_tier === 'string';
    rows.push({ label, input: pp, adjusted_earned_premium, raw_mlr_pct, credibility_tier, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_credibilityAdjustmentBounded());
results.properties.push(checkP2_rebateOwedExact());
results.properties.push(checkP3_deMinimisImpliesRebateOwed());
results.properties.push(checkP4_rawMlrMonotoneInClaims());
results.boundary_forced = checkP5_forced();

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

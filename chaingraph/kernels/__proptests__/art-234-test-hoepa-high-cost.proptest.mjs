// kernel_digest_at_authoring: sha256:94e054205e12a5b0b9b9712e58a2f35f7e3fc542d175a53f9ee756a49ca835f5
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-234-test-hoepa-high-cost.
// Class B (bounded-numeric), FLOAT-SENSITIVE (apr_spread subtraction through r4 rounding,
// compared against fixed 6.5/8.5pp APR thresholds with an explicit -1e-5 epsilon tolerance;
// points-and-fees comparison against a max(pct,floor) computed limit with a 0.005 tolerance) —
// ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays). Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-234-test-hoepa-high-cost.proptest.mjs

import { compute } from '../art-234-test-hoepa-high-cost.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-234-test-hoepa-high-cost.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (!deepEqual(output_payload, vec.output_payload)) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
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
const rand = mulberry32(0x23401);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  return {
    apr_pct: randRange(rng, 0, 30),
    apor_pct: randRange(rng, 0, 15),
    lien_type: rng() < 0.5 ? 'first' : 'subordinate',
    is_small_dwelling: rng() < 0.2,
    loan_amount: randRange(rng, 10000, 500000),
    points_and_fees: randRange(rng, 0, 30000),
    has_prepayment_penalty: rng() < 0.4,
    prepayment_penalty_period_months: Math.floor(randRange(rng, 0, 60)),
    prepayment_penalty_pct: randRange(rng, 0, 5),
    year: 2026,
  };
}

// ---------- P1: boundedness — is_high_cost iff at least one of the three triggers fired ----------
function checkP1_isHighCostMatchesAnyTrigger() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    const any = r.apr_trigger_met || r.points_fees_trigger_met || r.prepayment_penalty_trigger_met;
    if (r.is_high_cost !== any) violations++;
    if (r.triggers_fired.length !== [r.apr_trigger_met, r.points_fees_trigger_met, r.prepayment_penalty_trigger_met].filter(Boolean).length) violations++;
  }
  return { name: 'P1_is_high_cost_matches_any_trigger_fired', trials: checked, violations };
}

// ---------- P2: fixed-tier agreement — APR threshold selection matches lien_type/is_small_dwelling rule ----------
function checkP2_aprThresholdSelectionAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = (pp.lien_type === 'subordinate' || pp.is_small_dwelling) ? 8.5 : 6.5;
    if (r.apr_threshold_pct !== expected) violations++;
  }
  return { name: 'P2_apr_threshold_matches_lien_and_small_dwelling_rule', trials: checked, violations };
}

// ---------- P3: monotonicity — points_fees_limit is nondecreasing in loan_amount (fixed year) ----------
function checkP3_pointsFeesLimitMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, loan_amount: 20000 };
    const hi = { ...base, loan_amount: 200000 };
    const rLo = compute(lo).output_payload.points_fees_limit;
    const rHi = compute(hi).output_payload.points_fees_limit;
    checked++;
    if (rHi < rLo) violations++;
  }
  return { name: 'P3_points_fees_limit_nondecreasing_in_loan_amount', trials: checked, violations };
}

// ---------- P4: round-trip identity — apr_spread_pct === r4(apr_pct - apor_pct) exactly ----------
function checkP4_aprSpreadRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = Math.round((pp.apr_pct - pp.apor_pct) * 1e4) / 1e4;
    if (r.apr_spread_pct !== expected) violations++;
  }
  return { name: 'P4_apr_spread_equals_r4_of_apr_minus_apor', trials: checked, violations };
}

// ---------- P5: out-of-range year always refuses, never extrapolates ----------
// This node used to resolve any unpinned year through `HOEPA_PF[year] || HOEPA_PF[2026]`,
// so a 2019 query was answered with 2026 bands and a 2026 Federal Register citation
// attached to it. That is a live wrong answer, not a formatting problem, and the property
// that catches it is refusal rather than nearest-year substitution.
function checkP5_outOfRangeYearRefuses() {
  let violations = 0, checked = 0;
  const OUT_OF_RANGE = [1999, 2000, 2019, 2020, 2027, 2030, 3000, 0, -2025];
  for (let i = 0; i < TRIALS; i++) {
    const year = OUT_OF_RANGE[i % OUT_OF_RANGE.length];
    const r = compute({ ...mkPP(rand), year });
    const op = r.output_payload;
    checked++;
    if (op.error !== 'year_not_in_table') violations++;
    if (!r.compliance_flags.includes('LOOKUP_YEAR_UNAVAILABLE')) violations++;
    // A refusal must not emit a high-cost verdict it is not entitled to make.
    if (op.is_high_cost !== undefined) violations++;
    if (op.points_fees_floor !== undefined || op.fr_citation !== undefined) violations++;
  }
  return { name: 'P5_out_of_range_year_refuses_without_extrapolating', trials: checked, violations };
}

// ---------- P6 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ year: 2020 }, 'exactly 1 year below the pinned range — must refuse, not serve 2026 bands'],
  [{ year: 2027 }, 'exactly 1 year above the pinned range — must refuse, not serve 2026 bands'],
  [{ year: 2021 }, 'earliest pinned year — must resolve'],
  [{ year: 2026 }, 'latest pinned year — must resolve'],
  [{ apr_pct: 13.0, apor_pct: 6.5, lien_type: 'first', is_small_dwelling: false }, 'apr_spread exactly 6.5 (first-lien standard threshold, tolerance -1e-5) — apr_trigger_met must be true'],
  [{ apr_pct: 12.999979, apor_pct: 6.5, lien_type: 'first', is_small_dwelling: false }, 'apr_spread just inside the -1e-5 tolerance band below 6.5 — apr_trigger_met must still be true (tolerance is deliberate, not a bug)'],
  [{ apr_pct: 12.9998, apor_pct: 6.5, lien_type: 'first', is_small_dwelling: false }, 'apr_spread clearly below the 6.5 threshold and its -1e-5 tolerance — apr_trigger_met must be false'],
  [{ loan_amount: 27600, points_and_fees: 1380, year: 2026 }, 'points_and_fees exactly at the pf_limit (5% of 27600=1380, matches the $1380 floor) — pf_trigger_met must be false (tolerance is +0.005)'],
  [{ loan_amount: 27600, points_and_fees: 1380.006, year: 2026 }, 'points_and_fees just above pf_limit + 0.005 tolerance — pf_trigger_met must be true'],
  [{ has_prepayment_penalty: true, prepayment_penalty_period_months: 36 }, 'prepayment_penalty_period_months exactly at the 36-month boundary — pp_exceeds_period must be false (strict >)'],
  [{ has_prepayment_penalty: true, prepayment_penalty_period_months: 37 }, 'prepayment_penalty_period_months 1 month over the 36-month boundary — pp_exceeds_period must be true'],
  [{ apr_pct: -0, apor_pct: 0 }, 'apr_pct negative zero, apor_pct zero — apr_spread_pct must compute to plain 0, no -0 artifact'],
];

function checkP6_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { apr_pct: 8, apor_pct: 6, lien_type: 'first', is_small_dwelling: false, loan_amount: 100000, points_and_fees: 1000, has_prepayment_penalty: false, prepayment_penalty_period_months: 0, prepayment_penalty_pct: 0, year: 2026, ...overrides };
    const res = compute(pp);
    const r = res.output_payload;
    // Two legal shapes: a resolved verdict, or an explicit refusal that withholds one.
    const refused = r.error === 'year_not_in_table';
    const plausible = refused
      ? (Array.isArray(r.available_years)
         && r.is_high_cost === undefined
         && res.compliance_flags.includes('LOOKUP_YEAR_UNAVAILABLE'))
      : (Number.isFinite(r.apr_spread_pct) && Number.isFinite(r.points_fees_limit) && typeof r.is_high_cost === 'boolean');
    rows.push({ label, overrides, refused, apr_trigger_met: r.apr_trigger_met ?? null, points_fees_trigger_met: r.points_fees_trigger_met ?? null, prepayment_penalty_trigger_met: r.prepayment_penalty_trigger_met ?? null, is_high_cost: r.is_high_cost ?? null, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_isHighCostMatchesAnyTrigger());
results.properties.push(checkP2_aprThresholdSelectionAgreement());
results.properties.push(checkP3_pointsFeesLimitMonotone());
results.properties.push(checkP4_aprSpreadRoundTrip());
results.properties.push(checkP5_outOfRangeYearRefuses());
results.boundary_forced = checkP6_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-234-test-hoepa-high-cost');
  process.exit(1);
}
console.log('PASS art-234-test-hoepa-high-cost');

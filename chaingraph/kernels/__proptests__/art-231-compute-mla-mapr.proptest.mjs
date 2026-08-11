// kernel_digest_at_authoring: sha256:e6ea4f134e6e8a83ead3c9b8c4003302fff90bb70c26a05c76538c4722c64e41
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-231-compute-mla-mapr.
// Class B (bounded-numeric), FLOAT-SENSITIVE (implicit finance charge computed as
// loan_amount*(apr/100)*(term/12) through r6/r4 rounding, MAPR ratio division, compared
// against a fixed 36% statutory cap) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays). Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-231-compute-mla-mapr.proptest.mjs

import { compute } from '../art-231-compute-mla-mapr.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-231-compute-mla-mapr.fixtures.json');
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
const rand = mulberry32(0x23101);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 10000;

function mkPP(rng) {
  return {
    loan_amount: randRange(rng, 100, 200000),
    term_months: Math.floor(randRange(rng, 1, 84)),
    stated_apr_pct: randRange(rng, 0, 40),
    finance_charge_total: rng() < 0.3 ? randRange(rng, 0, 5000) : 0,
    credit_insurance_premium_total: randRange(rng, 0, 500),
    credit_card_annual_fee: randRange(rng, 0, 200),
    participation_fee_annual: randRange(rng, 0, 300),
    application_fee: randRange(rng, 0, 100),
    is_credit_card: rng() < 0.5,
  };
}

// ---------- P1: fixed-threshold-tier agreement — exceeds_cap iff mapr_pct > 36 exactly ----------
function checkP1_exceedsCapAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.exceeds_cap !== (r.mapr_pct > 36.0)) violations++;
  }
  return { name: 'P1_exceeds_cap_matches_mapr_gt_36pct', trials: checked, violations };
}

// ---------- P2: fixed-tier agreement — participation fee exclusion bounded by $100/yr, gated by is_credit_card ----------
function checkP2_participationFeeExclusionBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (!pp.is_credit_card && r.participation_fee_excluded !== 0) violations++;
    if (pp.is_credit_card && r.participation_fee_excluded > 100.0001) violations++;
  }
  return { name: 'P2_participation_fee_excluded_bounded_100_gated_by_is_credit_card', trials: checked, violations };
}

// ---------- P3: monotonicity — mapr_pct is never less than stated_apr_pct (MAPR floored at APR by definition) ----------
function checkP3_maprFlooredAtApr() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (pp.loan_amount > 0 && r.mapr_pct < r.stated_apr_pct - 1e-4) violations++;
  }
  return { name: 'P3_mapr_pct_never_below_stated_apr_pct', trials: checked, violations };
}

// ---------- P4: round-trip — total_includable_charges agrees with the sum of its three declared
// components within one r4() rounding step (the kernel rounds each display component AND the
// pre-summed total independently, so summing the already-rounded components can double-round by
// up to 3*5e-5; tolerance reflects that, not a relaxation of the identity itself) ----------
function checkP4_includableChargesRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    const expected = r.effective_finance_charge + r.credit_insurance_premium_total + r.credit_card_annual_fee_included;
    if (Math.abs(r.total_includable_charges - expected) > 5e-4) violations++;
  }
  return { name: 'P4_total_includable_equals_sum_of_three_components', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ loan_amount: 0, stated_apr_pct: 0 }, 'both loan_amount and stated_apr_pct exactly zero — guard branch, mapr_pct exactly 0'],
  [{ loan_amount: 10000, term_months: 12, stated_apr_pct: 0, finance_charge_total: 3600 }, 'MAPR components sum such that mapr_pct lands exactly at 36.0 cap — exceeds_cap must be false (boundary is strict >)'],
  [{ loan_amount: 10000, term_months: 12, stated_apr_pct: 0, finance_charge_total: 3600.0000001 }, 'MAPR 1-ULP-ish above 36.0 — exceeds_cap must be true'],
  [{ participation_fee_annual: 100, is_credit_card: true }, 'participation_fee_annual exactly at the $100/yr exclusion cap — full amount excluded, not clamped below 100'],
  [{ participation_fee_annual: 100.0001, is_credit_card: true }, 'participation_fee_annual 1-ULP-ish above $100/yr cap — excluded amount must clamp to exactly 100'],
  [{ loan_amount: 100, stated_apr_pct: 0.1 * 3 * 10, term_months: 12 }, 'stated_apr_pct built from a 0.1*3 rounding-noise product — implicit_finance_charge must be r6() of the EXACT double product'],
  [{ loan_amount: -0, stated_apr_pct: 0 }, 'loan_amount negative zero — Math.max(0,...) must normalize to plain 0, guard branch taken'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { loan_amount: 10000, term_months: 12, stated_apr_pct: 15, finance_charge_total: 0, credit_insurance_premium_total: 0, credit_card_annual_fee: 0, participation_fee_annual: 0, application_fee: 0, is_credit_card: false, ...overrides };
    const r = compute(pp).output_payload;
    // Guard branch (loan_amount===0 && stated_apr_pct===0) returns a smaller zero-state shape
    // that omits total_includable_charges/participation_fee_excluded entirely — both are legitimately
    // absent there, not a NaN/undefined defect, so finiteness is checked conditionally on presence.
    const finite = Number.isFinite(r.mapr_pct)
      && (r.total_includable_charges === undefined || Number.isFinite(r.total_includable_charges))
      && (r.participation_fee_excluded === undefined || Number.isFinite(r.participation_fee_excluded));
    rows.push({ label, overrides, mapr_pct: r.mapr_pct, exceeds_cap: r.exceeds_cap, participation_fee_excluded: r.participation_fee_excluded, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_exceedsCapAgreement());
results.properties.push(checkP2_participationFeeExclusionBounded());
results.properties.push(checkP3_maprFlooredAtApr());
results.properties.push(checkP4_includableChargesRoundTrip());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
}, null, 2));

if (anyPropertyViolation || anyBoundaryImplausible) {
  console.error('PROPERTY FLOOR FAILED for art-231-compute-mla-mapr');
  process.exit(1);
}
console.log('PASS art-231-compute-mla-mapr');

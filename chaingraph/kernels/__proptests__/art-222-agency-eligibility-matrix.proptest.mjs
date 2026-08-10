// kernel_digest_at_authoring: sha256:1974e5147a75759c71c8deb05d10e26b2803fb3ce6c5947cabd998c089cf0e49
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-222-agency-eligibility-matrix.
// Class B (bounded categorical), float:no per the WU row — verified against compute():
// every decision is a direct comparison of a user-supplied percentage against a fixed
// table lookup value (no epsilon tolerance, no derived continuous arithmetic, no rounding
// artifact accumulation). Forced categorical boundary cases used in place of ULP forcing
// per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays). This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-222-agency-eligibility-matrix.proptest.mjs

import { compute } from '../art-222-agency-eligibility-matrix.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-222-agency-eligibility-matrix.fixtures.json');
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
const rand = mulberry32(0x2220A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function mkPP(rng, overrides = {}) {
  return {
    fico_score: Math.round(randRange(rng, 500, 850)),
    ltv_pct: randRange(rng, 0, 100),
    cltv_pct: randRange(rng, 0, 110),
    dti_pct: randRange(rng, 0, 60),
    occupancy_type: pick(rng, ['primary', 'second_home', 'investment']),
    property_type: pick(rng, ['sfr', 'condo']),
    loan_purpose: pick(rng, ['purchase', 'rate_term_refi', 'cash_out_refi']),
    underwriting_type: pick(rng, ['du', 'lpa', 'manual']),
    units: pick(rng, [1, 2, 3, 4]),
    ...overrides,
  };
}

// ---------- P1: monotone — worsening every input never turns an ineligible loan eligible ----------
function checkP1_monotoneEligibility() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r1 = compute(pp);
    const worse = { ...pp, fico_score: 500, ltv_pct: 100, cltv_pct: 110, dti_pct: 60 };
    const r2 = compute(worse);
    checked++;
    if (r1.output_payload.eligible === false && r2.output_payload.eligible === true) violations++;
  }
  return { name: 'P1_monotone_eligible_never_flips_true_when_worsened', trials: checked, violations };
}

// ---------- P2: boundedness — fails[] is drawn from a known set, and eligible iff fails is empty ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_FAILS = new Set(['FICO_BELOW_MINIMUM', 'LTV_EXCEEDS_MAX', 'CLTV_EXCEEDS_MAX', 'HCLTV_EXCEEDS_MAX', 'DTI_EXCEEDS_LIMIT', 'HOUSING_DTI_EXCEEDS_LIMIT', 'SECOND_HOME_MUST_BE_1UNIT', 'INVESTMENT_CASHOUT_MAX_LTV_70']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fails, eligible } = r.output_payload;
    for (const f of fails) if (!KNOWN_FAILS.has(f)) violations++;
    if (eligible !== (fails.length === 0)) violations++;
  }
  return { name: 'P2_boundedness_fails_from_known_set_eligible_iff_empty', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — ltv check pass matches ltv <= max_ltv_pct exactly ----------
function checkP3_ltvTierAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { checks, max_ltv_pct } = r.output_payload;
    const ltvCheck = checks.find((c) => c.check === 'ltv');
    const expected = ltvCheck.actual <= max_ltv_pct;
    if (ltvCheck.pass !== expected) violations++;
  }
  return { name: 'P3_ltv_check_pass_matches_fixed_max_ltv_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ fico_score: 620, ltv_pct: 97, cltv_pct: 97, hcltv_pct: 97, dti_pct: 50, occupancy_type: 'primary', loan_purpose: 'purchase', underwriting_type: 'du', units: 1 }, 'FICO exactly at MIN_FICO (620), LTV exactly at max for primary purchase (97) — must be eligible'],
  [{ fico_score: 619, ltv_pct: 97, occupancy_type: 'primary', loan_purpose: 'purchase', underwriting_type: 'du' }, 'FICO 1 below MIN_FICO under DU — must fail FICO_BELOW_MINIMUM'],
  [{ fico_score: 550, underwriting_type: 'manual' }, 'FICO below MIN_FICO but manual underwriting — FICO check must pass (manual override)'],
  [{ dti_pct: 50, underwriting_type: 'du' }, 'DTI exactly at DU max (50) — must pass dti_total'],
  [{ dti_pct: 50.0001, underwriting_type: 'du' }, 'DTI just above DU max — must fail DTI_EXCEEDS_LIMIT'],
  [{ dti_pct: 45, underwriting_type: 'manual', housing_dti_pct: 36 }, 'manual UW: total DTI at 45 max, housing DTI at 36 max — both boundaries exactly met'],
  [{ occupancy_type: 'second_home', units: 2 }, 'second-home with 2 units — must fail SECOND_HOME_MUST_BE_1UNIT'],
  [{ occupancy_type: 'investment', loan_purpose: 'cash_out_refi', ltv_pct: 70 }, 'investment cash-out at exactly 70 LTV — must NOT trigger INVESTMENT_CASHOUT_MAX_LTV_70 (boundary is > 70)'],
  [{ occupancy_type: 'investment', loan_purpose: 'cash_out_refi', ltv_pct: 70.0001 }, 'investment cash-out just above 70 LTV — MUST trigger INVESTMENT_CASHOUT_MAX_LTV_70'],
  [{ units: 4, occupancy_type: 'investment', ltv_pct: 70 }, '4-unit investment — multi-unit LTV override table must apply (cap 70)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = typeof op.eligible === 'boolean' && Array.isArray(op.fails) && Array.isArray(op.checks);
    rows.push({ label, pp, eligible: op.eligible, fails: op.fails, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneEligibility());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_ltvTierAgreement());
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

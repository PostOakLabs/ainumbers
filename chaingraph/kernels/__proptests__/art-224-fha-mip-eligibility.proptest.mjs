// kernel_digest_at_authoring: sha256:0188afefdc40d10dd5d1058b02fdf32126f50994c6cdfc0389f7e1cf93cfe295
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-224-fha-mip-eligibility.
// Class B (bounded-numeric), FLOAT-SENSITIVE (UFMIP/annual-MIP amounts are continuous rate
// arithmetic with r2/r4 rounding, and LTV/DTI eligibility gates are direct float
// comparisons) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero
// external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as B1-B5's
// float harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-224-fha-mip-eligibility.proptest.mjs

import { compute } from '../art-224-fha-mip-eligibility.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-224-fha-mip-eligibility.fixtures.json');
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
const rand = mulberry32(0x2240A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 12000;
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

function mkPP(rng, overrides = {}) {
  return {
    base_loan_amount: randRange(rng, 10000, 1000000),
    ltv_pct: randRange(rng, 0, 100),
    term_years: Math.round(randRange(rng, 1, 30)),
    fico_score: Math.round(randRange(rng, 400, 850)),
    front_end_dti_pct: randRange(rng, 0, 60),
    back_end_dti_pct: randRange(rng, 0, 70),
    loan_purpose: 'purchase',
    ...overrides,
  };
}

// ---------- P1: round-trip identity — ufmip.amount equals r2(base_loan_amount * 0.0175) exactly ----------
function checkP1_ufmipIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { ufmip } = r.output_payload;
    const expected = r2(pp.base_loan_amount * 0.0175);
    if (Math.abs(ufmip.amount - expected) > 1e-6) violations++;
  }
  return { name: 'P1_ufmip_amount_matches_r2_identity', trials: checked, violations };
}

// ---------- P2: monotone — max_ltv_pct is nonincreasing as FICO decreases across the 580/500 tier boundaries ----------
function checkP2_monotoneMaxLtv() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand);
    const lo = { ...base, fico_score: Math.round(randRange(rand, 500, 579)) };
    const hi = { ...base, fico_score: Math.round(randRange(rand, 580, 850)) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.max_ltv_pct < rLo.output_payload.max_ltv_pct) violations++;
  }
  return { name: 'P2_monotone_max_ltv_nondecreasing_with_fico_tier', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — fha_eligible matches ficoOk && ltvOk exactly ----------
function checkP3_eligibilityAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fha_eligible, fico_eligible, ltv_eligible } = r.output_payload;
    if (fha_eligible !== (fico_eligible && ltv_eligible)) violations++;
  }
  return { name: 'P3_fha_eligible_matches_fico_and_ltv_and_conjunction', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ fico_score: 500, base_loan_amount: 300000, ltv_pct: 90 }, 'FICO exactly at the 500 eligibility floor — must be fico_eligible'],
  [{ fico_score: 499.9999, base_loan_amount: 300000, ltv_pct: 90 }, 'FICO just below 500 — must NOT be fico_eligible'],
  [{ fico_score: 580, base_loan_amount: 300000, ltv_pct: 96.5 }, 'FICO exactly at the 580 tier boundary, LTV exactly at 96.5 max — must be ltv_eligible'],
  [{ fico_score: 579.9999, base_loan_amount: 300000, ltv_pct: 96.5 }, 'FICO just below 580 (90% max LTV tier) — 96.5 LTV must NOT be eligible'],
  [{ base_loan_amount: 726200, ltv_pct: 90, term_years: 30 }, 'base_loan_amount exactly at the $726,200 MIP threshold — must use the <= threshold rate tier'],
  [{ base_loan_amount: 726200.01, ltv_pct: 90, term_years: 30 }, 'base_loan_amount 1 cent above the MIP threshold — must use the higher rate tier'],
  [{ base_loan_amount: 300000, ltv_pct: 90, term_years: 15 }, 'term_years exactly at the 15-year boundary — must use the <=15yr rate table'],
  [{ base_loan_amount: 300000, ltv_pct: 90, term_years: 15.0001 }, 'term_years just above 15 — must use the >15yr rate table'],
  [{ base_loan_amount: 300000, ltv_pct: 90, term_years: 30 }, 'MIP duration boundary: LTV exactly 90 — must be 11_years duration, not life_of_loan'],
  [{ base_loan_amount: 300000, ltv_pct: 90.0001, term_years: 30 }, 'LTV just above 90 — MIP duration must flip to life_of_loan'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.ufmip.amount) && Number.isFinite(op.annual_mip.annual_amount) && typeof op.fha_eligible === 'boolean';
    rows.push({ label, overrides, fha_eligible: op.fha_eligible, mip_duration: op.annual_mip.duration, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_ufmipIdentity());
results.properties.push(checkP2_monotoneMaxLtv());
results.properties.push(checkP3_eligibilityAgreement());
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

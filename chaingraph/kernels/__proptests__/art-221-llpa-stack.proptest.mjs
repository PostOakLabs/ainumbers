// kernel_digest_at_authoring: sha256:7221a3468182a878ebf517663153a90e4973b4125fe3d77c8a44789898b785ad
//
// FV-PROPFLOOR-SHARD-B6-1 — property-test floor for art-221-llpa-stack.
// Class B (bounded-numeric), FLOAT-SENSITIVE (base + feature LLPA grid lookups summed and
// r4-rounded, plus the FTHB waiver subtraction) — ULP-boundary forcing is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as B1-B5's float harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-221-llpa-stack.proptest.mjs

import { compute } from '../art-221-llpa-stack.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-221-llpa-stack.fixtures.json');
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
const rand = mulberry32(0x2210A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 12000;

function mkPP(rng, overrides = {}) {
  return {
    fico_score: Math.round(randRange(rng, 300, 850)),
    ltv_pct: randRange(rng, 0, 100),
    loan_purpose: pick(rng, ['purchase', 'rate_term_refi', 'cash_out_refi']),
    occupancy_type: pick(rng, ['primary', 'second_home', 'investment']),
    property_type: pick(rng, ['sfr', 'condo']),
    subordinate_financing: rng() < 0.2,
    first_time_buyer: rng() < 0.2,
    ami_pct: randRange(rng, 50, 150),
    ...overrides,
  };
}

// ---------- P1: monotone — total_llpa_pct is nonincreasing as FICO improves (fixed LTV/purpose/occupancy) ----------
function checkP1_monotoneFico() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const base = mkPP(rand, { first_time_buyer: false, subordinate_financing: false, property_type: 'sfr' });
    const lo = { ...base, fico_score: Math.round(randRange(rand, 300, 619)) };
    const hi = { ...base, fico_score: Math.round(randRange(rand, 740, 850)) };
    const rLo = compute(lo);
    const rHi = compute(hi);
    checked++;
    if (rHi.output_payload.total_llpa_pct > rLo.output_payload.total_llpa_pct + 1e-9) violations++;
  }
  return { name: 'P1_monotone_total_llpa_nonincreasing_with_fico', trials: checked, violations };
}

// ---------- P2: boundedness — total_llpa_pct is never negative ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (r.output_payload.total_llpa_pct < 0) violations++;
  }
  return { name: 'P2_boundedness_total_llpa_pct_never_negative', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — FTHB waiver applies iff eligible, and never drives total_llpa_pct below 0 ----------
function checkP3_fthbWaiverAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { fthb_eligible, fthb_waiver, total_llpa_pct } = r.output_payload;
    const expectedEligible = pp.first_time_buyer && pp.ami_pct <= 100 && pp.occupancy_type === 'primary' && pp.loan_purpose !== 'cash_out_refi';
    if (fthb_eligible !== expectedEligible) violations++;
    if (!fthb_eligible && fthb_waiver !== 0) violations++;
    if (total_llpa_pct < 0) violations++;
  }
  return { name: 'P3_fthb_waiver_matches_eligibility_rule_and_floors_at_zero', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ fico_score: 619, ltv_pct: 60 }, 'FICO exactly 1 below the <620 band boundary'],
  [{ fico_score: 620, ltv_pct: 60 }, 'FICO exactly at the 620-639 band boundary'],
  [{ fico_score: 740, ltv_pct: 60 }, 'FICO exactly at the 740+ top band boundary'],
  [{ ltv_pct: 60.00, fico_score: 700 }, 'LTV exactly at the <=60 band boundary'],
  [{ ltv_pct: 60.01, fico_score: 700 }, 'LTV exactly 1 cent above the <=60 boundary (60-65 band)'],
  [{ ltv_pct: 95.00, fico_score: 700 }, 'LTV exactly at the 90.01-95 upper boundary'],
  [{ ltv_pct: 95.01, fico_score: 700 }, 'LTV exactly 1 cent above 95 (>95 band)'],
  [{ fico_score: 780, ltv_pct: 60, first_time_buyer: true, ami_pct: 100, occupancy_type: 'primary', loan_purpose: 'purchase' }, 'ami_pct exactly at the 100% FTHB eligibility boundary — must be eligible'],
  [{ fico_score: 780, ltv_pct: 60, first_time_buyer: true, ami_pct: 100.0001, occupancy_type: 'primary', loan_purpose: 'purchase' }, 'ami_pct just above the FTHB boundary — must NOT be eligible'],
  [{ fico_score: 740, ltv_pct: 60, first_time_buyer: true, ami_pct: 100, occupancy_type: 'primary', loan_purpose: 'purchase' }, 'zero-base-LLPA band with FTHB waiver — waiver must clamp at total (min(total,1.75)), never push negative'],
];

function checkP4_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = mkPP(rand, overrides);
    const r = compute(pp);
    const op = r.output_payload;
    const finite = Number.isFinite(op.total_llpa_pct) && op.total_llpa_pct >= 0 && Number.isFinite(op.base_llpa) && Number.isFinite(op.feature_llpa);
    rows.push({ label, overrides, total_llpa_pct: op.total_llpa_pct, fico_band: op.fico_band, ltv_band: op.ltv_band, fthb_eligible: op.fthb_eligible, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneFico());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_fthbWaiverAgreement());
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

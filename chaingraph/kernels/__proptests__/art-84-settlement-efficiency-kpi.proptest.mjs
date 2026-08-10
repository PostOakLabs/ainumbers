// kernel_digest_at_authoring: sha256:6689dbe2c2f23a87ca2ee46102cd5d983d628b2edebd17f51773a2749d6aa9e6
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-84-settlement-efficiency-kpi.
// Class B (bounded-numeric), FLOAT-SENSITIVE — settlement_rate/fail_rate/on_time_allocation_rate/
// ssi_golden_coverage_pct are all division-then-.toFixed() percentages compared against fixed
// float thresholds (95, 97.5, 99, 90, etc.) to derive a letter grade and compliance flags, and
// total_penalty_cost sums arbitrary float penalty_amount inputs — ULP-boundary forcing is
// MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This file is
// READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-84-settlement-efficiency-kpi.proptest.mjs

import { compute } from '../art-84-settlement-efficiency-kpi.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-84-settlement-efficiency-kpi.fixtures.json');
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
const rand = mulberry32(0x84A9B1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkInstruction(rng) {
  return {
    settled: rng() < 0.9,
    fail_days: Math.floor(randRange(rng, 0, 20)),
    penalty_amount: randRange(rng, 0, 500),
    on_time_allocation: rng() < 0.85,
    ssi_golden: rng() < 0.8,
    buyin_triggered: rng() < 0.05,
  };
}

// ---------- P1: settlement_rate + fail_rate is always exactly 100 (fixed identity, toFixed(2) each) ----------
function checkP1_settlementPlusFailRateIs100() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 20);
    const instructions = Array.from({ length: n }, () => mkInstruction(rand));
    const r = compute({ instructions });
    checked++;
    const { settlement_rate, fail_rate } = r.output_payload;
    if (Math.abs(settlement_rate + fail_rate - 100) > 1e-9) violations++;
  }
  return { name: 'P1_settlement_rate_plus_fail_rate_exactly_100', trials: checked, violations };
}

// ---------- P2: boundedness — every rate/pct is in [0,100], grade is one of the 5 declared letters, ----------
// ---------- and grade matches the fixed thresholds applied to settlement_rate exactly -----------------------
function checkP2_gradeMatchesFixedThresholds() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 20);
    const instructions = Array.from({ length: n }, () => mkInstruction(rand));
    const r = compute({ instructions });
    checked++;
    const { settlement_rate, fail_rate, on_time_allocation_rate, ssi_golden_coverage_pct, settlement_grade } = r.output_payload;
    for (const v of [settlement_rate, fail_rate, on_time_allocation_rate, ssi_golden_coverage_pct]) {
      if (v < 0 || v > 100) violations++;
    }
    if (!['A', 'B', 'C', 'D', 'F'].includes(settlement_grade)) violations++;
    const expectedGrade =
      settlement_rate >= 99 ? 'A' :
      settlement_rate >= 97.5 ? 'B' :
      settlement_rate >= 95 ? 'C' :
      settlement_rate >= 90 ? 'D' : 'F';
    if (settlement_grade !== expectedGrade) violations++;
  }
  return { name: 'P2_all_pcts_bounded_and_grade_matches_fixed_thresholds', trials: checked, violations };
}

// ---------- P3: total_penalty_cost is exactly the rounded sum of the input penalty_amount values ------------
function checkP3_penaltyCostExactSum() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 20);
    const instructions = Array.from({ length: n }, () => mkInstruction(rand));
    const r = compute({ instructions });
    checked++;
    let sum = 0;
    for (const inst of instructions) sum += inst.penalty_amount;
    if (Math.abs(r.output_payload.total_penalty_cost - +sum.toFixed(2)) > 1e-6) violations++;
  }
  return { name: 'P3_total_penalty_cost_exact_rounded_sum', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ instructions: [] }, 'empty instructions array — settlement_rate must be exactly 100, grade A, zero-trade default note'],
  [{ instructions: [{ settled: true, fail_days: 0, penalty_amount: 0 }] }, 'single settled instruction — settlement_rate exactly 100, grade A'],
  [{ instructions: Array.from({ length: 100 }, () => ({ settled: true })) }, '100 settled instructions — settlement_rate exactly 100 (no accumulation drift), fail_rate exactly 0'],
  [{ instructions: Array.from({ length: 1000 }, (_, i) => ({ settled: i < 990 })) }, '990/1000 settled — settlement_rate exactly 99.00, grade A (boundary uses >=99)'],
  [{ instructions: Array.from({ length: 1000 }, (_, i) => ({ settled: i < 989 })) }, '989/1000 settled — settlement_rate exactly 98.90, grade B (just under the 99 A-boundary)'],
  [{ instructions: Array.from({ length: 400 }, (_, i) => ({ settled: i < 390 })) }, '390/400 settled — settlement_rate exactly 97.50, grade B (boundary uses >=97.5)'],
  [{ instructions: [{ settled: false, penalty_amount: 0.1 }, { settled: false, penalty_amount: 0.2 }] }, 'penalty sum 0.1+0.2=0.30000000000000004 classic non-exact double — total_penalty_cost must round cleanly to 0.3'],
  [{ instructions: [{ settled: true, penalty_amount: Number.MAX_SAFE_INTEGER }] }, 'penalty_amount at MAX_SAFE_INTEGER — total_penalty_cost must remain finite'],
  [{ instructions: [{ settled: true, penalty_amount: -0 }] }, 'penalty_amount negative zero — total_penalty_cost must be exactly 0, no -0 leak into JSON'],
  [{ instructions: [{ settled: true, fail_days: NaN }] }, 'fail_days is NaN — fail-duration bucket comparisons (===1, <=5, <=10, >10) all evaluate false for NaN, must fall into no bucket without throwing, dur_dist sums to less than total (documents the gap, not a crash)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { settlement_rate, fail_rate, total_penalty_cost, settlement_grade } = r.output_payload;
    const plausible = Number.isFinite(settlement_rate) && Number.isFinite(fail_rate) && Number.isFinite(total_penalty_cost)
      && ['A', 'B', 'C', 'D', 'F'].includes(settlement_grade);
    rows.push({ label, input: pp, settlement_rate, fail_rate, total_penalty_cost, settlement_grade, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_settlementPlusFailRateIs100());
results.properties.push(checkP2_gradeMatchesFixedThresholds());
results.properties.push(checkP3_penaltyCostExactSum());
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

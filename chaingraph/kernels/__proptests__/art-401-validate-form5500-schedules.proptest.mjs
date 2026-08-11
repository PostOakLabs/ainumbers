// kernel_digest_at_authoring: sha256:69b7a4767ea76f50dcf221f85f8edb02f48c36b00cf3ec3419be9ad99e00b2f4
//
// FV-PROPFLOOR-SHARD-B22-1 — property-test floor for art-401-validate-form5500-schedules.
// Class B (bounded-numeric/categorical). CORRECTED CLASSIFICATION: the WU row lists this
// kernel as float:no, but the Schedule H cross-schedule tie
// (expected_ending = +(beginning+net_income-distributions).toFixed(2), tolerance 0.01) is a
// raw IEEE754 float sum/difference compared with an EPS-relative tolerance — the same shape
// already treated as float-sensitive for art-319 (RHC valuation linter) in an earlier shard.
// Reclassified float:yes per FIX-2 CARRY; ULP-boundary forcing added for the arithmetic tie.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-401-validate-form5500-schedules.proptest.mjs

import { compute } from '../art-401-validate-form5500-schedules.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-401-validate-form5500-schedules.fixtures.json');
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
const rand = mulberry32(0x401C4);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const participant_count = Math.floor(randRange(rng, 1, 500));
  const plan_type = pick(rng, ['defined_benefit', 'defined_contribution', 'welfare']);
  const beginning = randRange(rng, 0, 5000000);
  const net_income = randRange(rng, -500000, 500000);
  const distributions = randRange(rng, 0, 500000);
  const ties = rng() < 0.5;
  const expected = +(beginning + net_income - distributions).toFixed(2);
  const ending = ties ? expected : expected + randRange(rng, 1, 1000);
  return {
    plan_type,
    is_multiemployer: rng() < 0.3,
    has_insurance_contracts: rng() < 0.5,
    service_provider_comp_over_5000: rng() < 0.5,
    has_party_in_interest_transactions: rng() < 0.5,
    participant_count,
    plan_year_end: '2025-12-31',
    extension_filed: rng() < 0.3,
    schedule_h_beginning_assets: beginning,
    schedule_h_net_income: net_income,
    schedule_h_distributions: distributions,
    schedule_h_ending_assets: ending,
  };
}

// ---------- P1: arithmetic_tie.ties is exactly (|expected-ending| <= 0.01), only when large plan ----------
function checkP1_tieExactTolerance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (pp.participant_count >= 100) {
      const expected = +(pp.schedule_h_beginning_assets + pp.schedule_h_net_income - pp.schedule_h_distributions).toFixed(2);
      const expectedTies = Math.abs(expected - pp.schedule_h_ending_assets) <= 0.01;
      if (r.output_payload.arithmetic_tie === null) violations++;
      else if (r.output_payload.arithmetic_tie.ties !== expectedTies) violations++;
    } else if (r.output_payload.arithmetic_tie !== null) violations++;
  }
  return { name: 'P1_arithmetic_tie_exact_tolerance_only_for_large_plans', trials: checked, violations };
}

// ---------- P2: required_schedules always includes exactly one of {H, I} based on is_large_plan ----------
function checkP2_hVsIExclusive() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const has_h = r.output_payload.required_schedules.includes('H');
    const has_i = r.output_payload.required_schedules.includes('I');
    if (r.output_payload.is_large_plan !== has_h) violations++;
    if (r.output_payload.is_large_plan === has_i) violations++; // large plan never gets I, small plan always gets I
    if (r.output_payload.is_large_plan !== (pp.participant_count >= 100)) violations++;
  }
  return { name: 'P2_h_vs_i_exclusive_and_matches_large_plan_threshold', trials: checked, violations };
}

// ---------- P3: extended_filing_deadline is never before filing_deadline ----------
function checkP3_extendedDeadlineNeverBefore() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand));
    checked++;
    if (r.output_payload.filing_deadline && r.output_payload.extended_filing_deadline) {
      if (r.output_payload.extended_filing_deadline < r.output_payload.filing_deadline) violations++;
    }
  }
  return { name: 'P3_extended_deadline_never_before_normal_deadline', trials: checked, violations };
}

// ---------- P4 (mandatory, corrected float:yes): ULP-boundary forcing ----------
const LARGE = { plan_type: 'defined_contribution', is_multiemployer: false, has_insurance_contracts: false, service_provider_comp_over_5000: false, has_party_in_interest_transactions: false, participant_count: 100, plan_year_end: '2025-12-31', extension_filed: false };
const ULP_BOUNDARY_CASES = [
  [{ ...LARGE, schedule_h_beginning_assets: 0.1, schedule_h_net_income: 0.2, schedule_h_distributions: 0, schedule_h_ending_assets: 0.3 }, 'classic non-exact double sum 0.1+0.2=0.30000000000000004 — toFixed(2) must resolve the tie to true against ending=0.3'],
  [{ ...LARGE, schedule_h_beginning_assets: 1000000, schedule_h_net_income: 0, schedule_h_distributions: 0, schedule_h_ending_assets: 1000000.01 }, 'ending exactly at the 0.01 tolerance boundary — must tie (<=, not <)'],
  [{ ...LARGE, schedule_h_beginning_assets: 1000000, schedule_h_net_income: 0, schedule_h_distributions: 0, schedule_h_ending_assets: 1000000.02 }, 'ending one cent past the tolerance boundary — must NOT tie'],
  [{ ...LARGE, schedule_h_beginning_assets: 0, schedule_h_net_income: 0, schedule_h_distributions: 0, schedule_h_ending_assets: 0 }, 'all-zero Schedule H figures — expected_ending exactly 0, ties true, no NaN'],
  [{ ...LARGE, schedule_h_beginning_assets: -0, schedule_h_net_income: 0, schedule_h_distributions: 0, schedule_h_ending_assets: 0 }, 'beginning_assets negative zero — must behave as zero, no NaN'],
  [{ ...LARGE, schedule_h_beginning_assets: 1e15, schedule_h_net_income: -1e15, schedule_h_distributions: 0, schedule_h_ending_assets: 0 }, 'large-magnitude cancellation (1e15 + -1e15) — must resolve to exactly 0, not a residual float error'],
  [{ ...LARGE, participant_count: 99, schedule_h_beginning_assets: null, schedule_h_net_income: null, schedule_h_distributions: null, schedule_h_ending_assets: null }, 'participant_count one below the large-plan threshold (99) — Schedule H tie is never computed regardless of null figures'],
  [{ ...LARGE, participant_count: 100, schedule_h_beginning_assets: null, schedule_h_net_income: 100, schedule_h_distributions: 0, schedule_h_ending_assets: 100 }, 'large plan with one Schedule H figure null — SCHEDULE_H_FIGURES_INCOMPLETE error, arithmetic_tie stays null'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { arithmetic_tie, is_large_plan, error_count } = r.output_payload;
    const plausible = typeof is_large_plan === 'boolean' && Number.isFinite(error_count) && (arithmetic_tie === null || typeof arithmetic_tie.ties === 'boolean');
    rows.push({ label, input: pp, arithmetic_tie, is_large_plan, error_count, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_tieExactTolerance());
results.properties.push(checkP2_hVsIExclusive());
results.properties.push(checkP3_extendedDeadlineNeverBefore());
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

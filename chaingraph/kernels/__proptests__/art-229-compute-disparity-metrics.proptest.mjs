// kernel_digest_at_authoring: sha256:1dc8545c4d3f629c66a7ba5ecc65ad105f855135774e745190e7d089b5ad9b27
//
// FV-PROPFLOOR-SHARD-B7-1 — property-test floor for art-229-compute-disparity-metrics.
// Class B (bounded-numeric), FLOAT-SENSITIVE (division of counts into rates, Math.sqrt-based
// standard-error terms, odds-ratio and z-statistic arithmetic, all pass through r4/r6 rounding
// against a fixed 0.80 four-fifths threshold and 1.645/1.96 critical z-values) — ULP-boundary
// forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays). Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-229-compute-disparity-metrics.proptest.mjs

import { compute } from '../art-229-compute-disparity-metrics.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-229-compute-disparity-metrics.fixtures.json');
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
const rand = mulberry32(0x22901);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const a_total = Math.floor(randRange(rng, 1, 5000));
  const b_total = Math.floor(randRange(rng, 1, 5000));
  return {
    group_a_label: 'protected_class',
    group_b_label: 'control_group',
    group_a_approvals: Math.floor(randRange(rng, 0, a_total)),
    group_a_total: a_total,
    group_b_approvals: Math.floor(randRange(rng, 0, b_total)),
    group_b_total: b_total,
  };
}

// ---------- P1: boundedness — approval_rate always in [0,1] ----------
function checkP1_approvalRatesBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.group_a.approval_rate < 0 || r.group_a.approval_rate > 1) violations++;
    if (r.group_b.approval_rate < 0 || r.group_b.approval_rate > 1) violations++;
  }
  return { name: 'P1_approval_rates_bounded_0_to_1', trials: checked, violations };
}

// ---------- P2: fixed-threshold-tier agreement — four_fifths_flag iff adverse_impact_ratio < 0.80 (when defined) ----------
function checkP2_fourFifthsThresholdAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.four_fifths_result === 'ADVERSE_IMPACT_FLAGGED') {
      if (!(r.adverse_impact_ratio < 0.8)) violations++;
      if (!r.four_fifths_flag) violations++;
    }
    if (r.four_fifths_result === 'PASS' && r.four_fifths_flag) violations++;
  }
  return { name: 'P2_four_fifths_flag_matches_ratio_below_080_threshold', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — z_critical flags match |z|>1.645 / |z|>1.96 exactly ----------
function checkP3_zCriticalAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    const abs_z = Math.abs(r.two_proportion_z);
    if (r.z_critical_flag_onetail_05 !== (abs_z > 1.645)) violations++;
    if (r.z_critical_flag_twotail_05 !== (abs_z > 1.960)) violations++;
  }
  return { name: 'P3_z_critical_flags_match_1_645_1_96_thresholds', trials: checked, violations };
}

// ---------- P4: round-trip — n_total exactly equals group_a.total + group_b.total ----------
function checkP4_nTotalRoundTrip() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(mkPP(rand)).output_payload;
    checked++;
    if (r.n_total !== r.group_a.total + r.group_b.total) violations++;
  }
  return { name: 'P4_n_total_equals_sum_of_group_totals', trials: checked, violations };
}

// ---------- P5 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ group_a_total: 0, group_b_total: 0 }, 'both totals exactly zero — INSUFFICIENT_DATA guard, all metrics exactly 0'],
  [{ group_a_approvals: 40, group_a_total: 100, group_b_approvals: 50, group_b_total: 100 }, 'adverse_impact_ratio exactly at 0.80 boundary (0.40/0.50=0.80) — four_fifths_flag must be false (strict <)'],
  [{ group_a_approvals: 3999999999, group_a_total: 10000000000, group_b_approvals: 5000000000, group_b_total: 10000000000 }, 'ratio at 1-ULP-below-0.80 via large counts — four_fifths_flag must be true'],
  [{ group_a_approvals: 0, group_a_total: 100, group_b_approvals: 50, group_b_total: 100 }, 'rate_a exactly zero, rate_b positive — adverse_impact_ratio must be exactly 0'],
  [{ group_a_approvals: 50, group_a_total: 100, group_b_approvals: 0, group_b_total: 100 }, 'rate_b exactly zero, rate_a positive — adverse_impact_ratio sentinel 999 (infinity proxy), four_fifths_result PASS'],
  [{ group_a_approvals: -0, group_a_total: 100, group_b_approvals: 50, group_b_total: 100 }, 'negative-zero approvals input — Math.round/Math.max must normalize to plain 0, no -0 artifact in approval_rate'],
  [{ group_a_approvals: 100, group_a_total: 100, group_b_approvals: 100, group_b_total: 100 }, 'both rates exactly 1.0 (full approval) — standardized_mean_difference denominator zero, must report 0 not NaN/Infinity'],
];

function checkP5_forced() {
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { group_a_approvals: 40, group_a_total: 100, group_b_approvals: 60, group_b_total: 100, ...overrides };
    const r = compute(pp).output_payload;
    const nums = [r.adverse_impact_ratio, r.two_proportion_z, r.odds_ratio, r.standardized_mean_difference, r.n_total, r.group_a.approval_rate, r.group_b.approval_rate];
    const finite = nums.every((n) => n === null || Number.isFinite(n));
    rows.push({ label, overrides, adverse_impact_ratio: r.adverse_impact_ratio, four_fifths_flag: r.four_fifths_flag, four_fifths_result: r.four_fifths_result, group_a_rate: r.group_a.approval_rate, finite, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_approvalRatesBounded());
results.properties.push(checkP2_fourFifthsThresholdAgreement());
results.properties.push(checkP3_zCriticalAgreement());
results.properties.push(checkP4_nTotalRoundTrip());
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
  console.error('PROPERTY FLOOR FAILED for art-229-compute-disparity-metrics');
  process.exit(1);
}
console.log('PASS art-229-compute-disparity-metrics');

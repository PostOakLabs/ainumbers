// art-251-compute-parametric-trigger-payout.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:21c850de44ea52edcd069ddb042c208ec8d8df8175a09b3fc3c9478245db8158
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — threshold comparisons (index_value >= threshold), a tiered payout_pct/100
// ratio, and the linear_index (index_value-threshold)/(max_index-threshold) division.
// Checks: fixture-oracle gate, termination (tiered loop bounded by tier_table.length),
// boundedness (trigger_fraction in [0,1], payout_amount <= min(coverage_amount,parametric_limit)),
// a linear_index monotonicity metamorphic check, a differential re-derivation of the linear
// fraction, and ULP-boundary forcing at the threshold/max_index edges (exact equality, span
// near zero, denormal-scale index values, negative zero).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-251-compute-parametric-trigger-payout.proptest.mjs

import { compute } from '../art-251-compute-parametric-trigger-payout.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-251-compute-parametric-trigger-payout.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x251A0);

function randomTiered(rng, n) {
  let lo = 0;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    const hi = i === n - 1 ? 0 : lo + rng() * 50; // last tier open-ended (hi=0)
    tiers.push({ lower_bound: lo, upper_bound: hi, payout_pct: Math.round(rng() * 100) });
    lo = hi;
  }
  return tiers;
}

const TRIALS = 5000;

// ---------- P1: termination — tiered loop bounded by tier_table.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const o = compute({
      trigger_type: 'tiered',
      index_value: rand() * 500,
      coverage_amount: 100000,
      parametric_limit: 100000,
      tier_table: randomTiered(rand, n),
    });
    checked++;
    if (n > 0 && o.tier_matched_index !== null && (o.tier_matched_index < 0 || o.tier_matched_index >= n)) violations++;
  }
  return { name: 'P1_termination_tiered_loop_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — trigger_fraction in [0,1], payout capped by coverage/limit ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const trigger_type = ['threshold', 'tiered', 'linear_index'][Math.floor(rand() * 3)];
    const coverage_amount = rand() * 200000;
    const parametric_limit = rand() * 200000;
    const p = {
      trigger_type,
      index_value: rand() * 200,
      threshold: rand() * 150,
      max_index: rand() * 300,
      coverage_amount,
      parametric_limit,
      tier_table: randomTiered(rand, Math.floor(rand() * 5)),
    };
    const o = compute(p);
    checked++;
    if (o.trigger_fraction < 0 || o.trigger_fraction > 1) violations++;
    if (o.payout_amount < 0) violations++;
    if (o.payout_amount > Math.min(coverage_amount, parametric_limit) + 0.01) violations++;
  }
  return { name: 'P2_trigger_fraction_and_payout_bounded', trials: checked, violations };
}

// ---------- P3 (metamorphic): linear_index monotonicity — payout never decreases as index_value rises ----------
function checkP3_linearMonotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const threshold = rand() * 100;
    const max_index = threshold + 1 + rand() * 200;
    const coverage_amount = 1000 + rand() * 100000;
    const base = { trigger_type: 'linear_index', threshold, max_index, coverage_amount, parametric_limit: coverage_amount };
    const x1 = rand() * (max_index + 50);
    const x2 = x1 + rand() * 50;
    const o1 = compute({ ...base, index_value: x1 });
    const o2 = compute({ ...base, index_value: x2 });
    checked++;
    if (o2.payout_amount < o1.payout_amount - 0.01) violations++;
  }
  return { name: 'P3_linear_index_payout_monotone_in_index_value', trials: checked, violations };
}

// ---------- P4 (differential): linear fraction re-derived independently ----------
function checkP4_differentialLinearFraction() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const threshold = rand() * 100;
    const max_index = threshold + 0.01 + rand() * 200;
    const index_value = rand() * (max_index + 50);
    const coverage_amount = 1000 + rand() * 100000;
    const o = compute({ trigger_type: 'linear_index', threshold, max_index, index_value, coverage_amount, parametric_limit: coverage_amount });
    checked++;
    const refFraction = Math.max(0, Math.min(1, (index_value - threshold) / (max_index - threshold)));
    if (Math.abs(o.trigger_fraction - refFraction) > 0.0002) violations++;
  }
  return { name: 'P4_differential_linear_fraction', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float:yes): threshold/max_index edges ----------
function checkP5_ulpForcing() {
  let violations = 0, checked = 0;
  const cases = [
    { trigger_type: 'threshold', index_value: 100, threshold: 100, coverage_amount: 5000, parametric_limit: 5000 }, // exact equality -> HIT
    { trigger_type: 'threshold', index_value: 99.999999, threshold: 100, coverage_amount: 5000, parametric_limit: 5000 }, // just under -> MISS
    { trigger_type: 'linear_index', index_value: 50, threshold: 50, max_index: 100, coverage_amount: 5000, parametric_limit: 5000 }, // fraction=0
    { trigger_type: 'linear_index', index_value: 100, threshold: 50, max_index: 100, coverage_amount: 5000, parametric_limit: 5000 }, // fraction=1
    { trigger_type: 'linear_index', index_value: 75, threshold: 50, max_index: 50, coverage_amount: 5000, parametric_limit: 5000 }, // span<=0 degenerate
    { trigger_type: 'linear_index', index_value: 1e-300, threshold: 0, max_index: 1e-299, coverage_amount: 5000, parametric_limit: 5000 }, // denormal-scale
    { trigger_type: 'threshold', index_value: -0, threshold: 0, coverage_amount: 5000, parametric_limit: 5000 }, // negative zero
  ];
  for (const c of cases) {
    checked++;
    const o = compute(c);
    if (!Number.isFinite(o.payout_amount)) violations++;
    if (o.trigger_fraction < 0 || o.trigger_fraction > 1) violations++;
  }
  const exactEq = compute(cases[0]);
  if (exactEq.trigger_hit !== true) violations++;
  const justUnder = compute(cases[1]);
  if (justUnder.trigger_hit !== false) violations++;
  const fracZero = compute(cases[2]);
  if (fracZero.trigger_fraction !== 0) violations++;
  const fracOne = compute(cases[3]);
  if (fracOne.trigger_fraction !== 1) violations++;
  const degenerate = compute(cases[4]);
  if (degenerate.payout_amount !== 0) violations++;
  return { name: 'P5_ulp_boundary_forcing_threshold_max_index_edges', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_linearMonotonicity());
results.properties.push(checkP4_differentialLinearFraction());
results.properties.push(checkP5_ulpForcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-251-compute-parametric-trigger-payout',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// art-426-cecl-ecl-calculator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:3a945610238be19cfb66bb261bdb544507d2eb0d978c45a98d4f4570da40e6f8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (r2/r6 rounding, clamp01 threshold on annual_loss_rate_pct /
// lifetime_loss_rate_pct / lgd_pct, discountFactor loop multiplies (1+rate) repeatedly) —
// ULP-boundary forcing is present below (threshold ±1 ULP, 0, negative zero, denormals).
// Checks: fixture-oracle gate, termination (segments/scenarios bounded by input array
// length), boundedness (all money outputs finite), differential re-derivation of
// total_required_allowance_usd and the rollforward reconciliation identity, metamorphic
// segment-order invariance, ULP-boundary forcing on clamp01 thresholds.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-426-cecl-ecl-calculator.proptest.mjs

import { compute } from '../art-426-cecl-ecl-calculator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-426-cecl-ecl-calculator.fixtures.json');
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
const rand = mulberry32(0x426A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const METHODS = ['warm', 'dcf', 'loss_rate'];

function randomScenario(rng, method) {
  if (method === 'dcf') {
    const n = Math.floor(rng() * 4);
    const pd_curve = Array.from({ length: n }, () => rng());
    const cash_flows = Array.from({ length: n }, (_, i) => ({ period: i + 1, contractual_payment_usd: rng() * 1e6 }));
    return { scenario: 'baseline', pd_curve, cash_flows };
  }
  return { scenario: pick(rng, ['baseline', 'downside', 'upside']), annual_loss_rate_pct: rng(), lifetime_loss_rate_pct: rng() };
}

function randomSegment(rng, method, id) {
  const n = 1 + Math.floor(rng() * 3);
  return {
    segment_id: 'seg-' + id,
    exposure_balance_usd: rng() * 1e7,
    remaining_life_years: rng() * 10,
    lgd_pct: rng(),
    effective_interest_rate_pct: rng() * 10,
    scenarios: Array.from({ length: n }, () => randomScenario(rng, method)),
  };
}

function randomPP(rng) {
  const method = pick(rng, METHODS);
  const n = Math.floor(rng() * 6);
  const segments = Array.from({ length: n }, (_, i) => randomSegment(rng, method, i));
  const forecast_weights = segments.length ? segments[0].scenarios.map((s) => ({ scenario: s.scenario, weight: rng() })) : [];
  return {
    method, constants_version: 'v1',
    prior_allowance_balance_usd: rng() * 1e6,
    charge_offs_usd: rng() * 1e5,
    recoveries_usd: rng() * 1e5,
    forecast_weights, segments,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — segment_count/scenario_count bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.segment_count !== pp.segments.length) violations++;
    output_payload.segments.forEach((s, idx) => {
      const inLen = pp.segments[idx] && Array.isArray(pp.segments[idx].scenarios) ? pp.segments[idx].scenarios.length : 0;
      if (s.scenario_count !== inLen) violations++;
    });
  }
  return { name: 'P1_termination_counts_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness — every money output is finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const fields = [output_payload.total_required_allowance_usd, output_payload.provision_expense_usd, output_payload.reconciled_ending_allowance_usd, output_payload.delta_vs_required_usd];
    if (fields.some((v) => !Number.isFinite(v))) violations++;
  }
  return { name: 'P2_boundedness_money_fields_finite', trials: checked, violations };
}

// ---------- P3 (differential): total_required_allowance_usd === sum(segment_ecl_usd) ----------
function checkP3_total_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = Math.round(output_payload.segments.reduce((a, s) => a + s.segment_ecl_usd, 0) * 100) / 100;
    if (Math.abs(expected - output_payload.total_required_allowance_usd) > 0.01) violations++;
  }
  return { name: 'P3_total_required_allowance_differential', trials: checked, violations };
}

// ---------- P4: reconciliation identity — reconciled_ending_allowance_usd always equals total_required (by construction) ----------
function checkP4_reconciliation_identity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (Math.abs(output_payload.reconciled_ending_allowance_usd - output_payload.total_required_allowance_usd) > 0.01) violations++;
    if (Math.abs(output_payload.delta_vs_required_usd) > 0.01) violations++;
  }
  return { name: 'P4_reconciliation_plug_identity', trials: checked, violations };
}

// ---------- P5: metamorphic — reordering segments never changes total_required_allowance_usd ----------
function checkP5_segment_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.segments.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { ...pp, segments: [...pp.segments].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.total_required_allowance_usd - r2v.total_required_allowance_usd) > 0.01) violations++;
  }
  return { name: 'P5_segment_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P6 (ULP-forcing): clamp01 boundary cases for rates/lgd ----------
function checkP6_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  const boundaryRates = [0, -0, 1, 1 - EPS, 1 + EPS, EPS, -EPS, Number.MIN_VALUE, -Number.MIN_VALUE, 1 - Number.MIN_VALUE];
  for (const rate of boundaryRates) {
    for (const method of METHODS) {
      const pp = {
        method, constants_version: 'v1', prior_allowance_balance_usd: 0, charge_offs_usd: 0, recoveries_usd: 0,
        forecast_weights: [{ scenario: 'baseline', weight: 1 }],
        segments: [{
          segment_id: 's1', exposure_balance_usd: 1000000, remaining_life_years: 1, lgd_pct: rate,
          effective_interest_rate_pct: rate * 10,
          scenarios: [{ scenario: 'baseline', annual_loss_rate_pct: rate, lifetime_loss_rate_pct: rate, pd_curve: [rate], cash_flows: [{ period: 1, contractual_payment_usd: 100000 }] }],
        }],
      };
      checked++;
      const { output_payload } = compute(pp);
      if (!Number.isFinite(output_payload.total_required_allowance_usd)) violations++;
      // clamp01 must keep effective rate in [0,1] regardless of forced boundary input
      const segLgd = output_payload.segments[0].lgd_pct;
      if (segLgd < 0 || segLgd > 1) violations++;
    }
  }
  return { name: 'P6_ulp_boundary_forcing_clamp01_thresholds', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_total_differential());
results.properties.push(checkP4_reconciliation_identity());
results.properties.push(checkP5_segment_order_metamorphic());
results.properties.push(checkP6_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-426-cecl-ecl-calculator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// art-442-nmd-behavioral-repricing-mapper.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C20-1).
// kernel_digest_at_authoring: sha256:8ebc318c72c432a4069b429e0d8e6a46991ee35df7fd9c6b7148e1ff8960606d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (direct source read confirmed — clamp01 on beta/allocation, r2
// rounding at every arithmetic step over an unbounded nmd_segments array, division for
// weighted_avg_beta) — ULP-boundary forcing present below on the clamp01 thresholds and the
// allocSum vs 1 tolerance compare (ALLOC_TOLERANCE = 0.001).
// Checks: fixture-oracle gate, termination (segment_results length bounded by input array
// length, buckets fixed to the 6 declared BUCKET_KEYS), boundedness (net_repricing_gap and
// totals finite), differential re-derivation of net_repricing_gap per bucket and
// weighted_avg_beta, metamorphic segment-order invariance of the bucket totals, ULP-boundary
// forcing on clamp01(beta/allocation) and the allocation-sums-to-one tolerance boundary.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-442-nmd-behavioral-repricing-mapper.proptest.mjs

import { compute } from '../art-442-nmd-behavioral-repricing-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };
const BUCKET_KEYS = ['on_1m', 'm1_y1', 'y1_y3', 'y3_y5', 'y5_y10', 'y10_plus'];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-442-nmd-behavioral-repricing-mapper.fixtures.json');
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
const rand = mulberry32(0x442A0);

function randomAllocation(rng) {
  const raw = BUCKET_KEYS.map(() => rng());
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const alloc = {};
  BUCKET_KEYS.forEach((k, i) => { alloc[k] = raw[i] / sum; });
  return alloc;
}

function randomSegment(rng, i) {
  return { name: 'seg-' + i, balance: rng() * 1e6, beta: rng(), allocation: randomAllocation(rng) };
}

function randomPP(rng) {
  const n = Math.floor(rng() * 8);
  return { nmd_segments: Array.from({ length: n }, (_, i) => randomSegment(rng, i)) };
}

const TRIALS = 5000;

// ---------- P1: termination — segment_results length bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.segment_results.length !== pp.nmd_segments.length) violations++;
    if (output_payload.buckets_used.length !== BUCKET_KEYS.length) violations++;
  }
  return { name: 'P1_termination_segment_results_bounded_by_input', trials: checked, violations };
}

// ---------- P2: boundedness — net_repricing_gap and totals finite ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (BUCKET_KEYS.some((k) => !Number.isFinite(output_payload.net_repricing_gap[k]))) violations++;
    if (![output_payload.total_net_repricing_gap, output_payload.weighted_avg_beta].every(Number.isFinite)) violations++;
  }
  return { name: 'P2_boundedness_bucket_gaps_and_totals_finite', trials: checked, violations };
}

// ---------- P3 (differential): net_repricing_gap per bucket re-derivation (deposits net negative) ----------
function checkP3_bucket_gap_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = BUCKET_KEYS.reduce((o, k) => { o[k] = 0; return o; }, {});
    for (const seg of pp.nmd_segments) {
      const balance = Math.max(0, seg.balance);
      const beta = Math.min(1, Math.max(0, seg.beta));
      for (const k of BUCKET_KEYS) {
        const a = Math.min(1, Math.max(0, seg.allocation[k]));
        const contribution = -(Math.round(balance * beta * a * 100) / 100);
        expected[k] = Math.round((expected[k] + contribution) * 100) / 100;
      }
    }
    for (const k of BUCKET_KEYS) {
      if (Math.abs(expected[k] - output_payload.net_repricing_gap[k]) > 0.05) violations++;
    }
    // every bucket contribution must be <= 0 (deposits are liabilities, per source comment)
    if (BUCKET_KEYS.some((k) => output_payload.net_repricing_gap[k] > 0.005)) violations++;
  }
  return { name: 'P3_bucket_gap_differential_and_liability_sign', trials: checked, violations };
}

// ---------- P4: metamorphic — reordering nmd_segments never changes total_net_repricing_gap ----------
function checkP4_segment_order_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    if (pp.nmd_segments.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const reversed = { nmd_segments: [...pp.nmd_segments].reverse() };
    const r2v = compute(reversed).output_payload;
    checked++;
    if (Math.abs(r1.total_net_repricing_gap - r2v.total_net_repricing_gap) > 0.05) violations++;
  }
  return { name: 'P4_segment_order_metamorphic_invariance', trials: checked, violations };
}

// ---------- P5 (ULP-forcing): clamp01(beta/allocation) and allocSum-tolerance boundary ----------
function checkP5_ulp_forcing() {
  let violations = 0, checked = 0;
  const EPS = Number.EPSILON;
  const boundaryVals = [0, -0, 1, 1 - EPS, 1 + EPS, EPS, -EPS, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const v of boundaryVals) {
    checked++;
    const allocation = BUCKET_KEYS.reduce((o, k) => { o[k] = v; return o; }, {});
    const { output_payload } = compute({ nmd_segments: [{ name: 's', balance: 1000, beta: v, allocation }] });
    if (!Number.isFinite(output_payload.total_net_repricing_gap)) violations++;
    if (output_payload.segment_results[0].beta < 0 || output_payload.segment_results[0].beta > 1) violations++;
  }
  // allocation-sums-to-one tolerance boundary (ALLOC_TOLERANCE = 0.001)
  // each individual bucket value is clamp01'd first, so a per-bucket boundary can't push the
  // SUM over tolerance alone (clamp01(1.0011) === 1) -- split the excess across two buckets
  // (each individually <=1) to actually force the allocSum tolerance boundary.
  const tolCases = [
    { name: 'exactly-one', a: 0.5, b: 0.5, expectValid: true },
    { name: 'just-inside', a: 0.50045, b: 0.50045, expectValid: true },
    { name: 'just-outside', a: 0.50055, b: 0.50055, expectValid: false },
  ];
  for (const c of tolCases) {
    checked++;
    const alloc = { on_1m: c.a, m1_y1: c.b, y1_y3: 0, y3_y5: 0, y5_y10: 0, y10_plus: 0 };
    const { output_payload } = compute({ nmd_segments: [{ name: 's', balance: 1000, beta: 0.5, allocation: alloc }] });
    if (output_payload.segment_results[0].sums_to_one !== c.expectValid) violations++;
  }
  return { name: 'P5_ulp_boundary_forcing_clamp01_and_alloc_tolerance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_bucket_gap_differential());
results.properties.push(checkP4_segment_order_metamorphic());
results.properties.push(checkP5_ulp_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-442-nmd-behavioral-repricing-mapper',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

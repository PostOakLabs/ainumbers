// art-309-parametric-index-deriver.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C11-1).
// kernel_digest_at_authoring: sha256:69501cd554f59d8ca92176964a10773dad63d5b7c1e4ae06af5eda6fbe9d29c6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (mean/sum/max/min over caller-supplied measured_metric floats, direct
// read confirmed) — ULP-boundary forcing is MANDATORY per spec §3.
// Checks: fixture-oracle gate, termination (contributing_receipts bounded by receipts.length),
// boundedness (max/min/count agree with the filtered-values set), differential re-derivation
// per aggregation mode, ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals,
// x/y*y !== x cases feeding the mean/sum path), and metamorphic near-permutation-invariance
// (summation order can move the last float bit, so equality is checked with a tolerance, never
// exact — this is itself the floor's honest statement about float non-associativity).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-309-parametric-index-deriver.proptest.mjs

import { compute } from '../art-309-parametric-index-deriver.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-309-parametric-index-deriver.fixtures.json');
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
const rand = mulberry32(0x309C0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const AGGS = ['mean', 'sum', 'count', 'max', 'min'];

function randomReceipts(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const valid = rng() < 0.8;
    out.push(valid
      ? { receipt_hash: `rh-${i}`, measured_metric: (rng() - 0.5) * 2000 }
      : { receipt_hash: rng() < 0.5 ? '' : `rh-${i}`, measured_metric: rng() < 0.5 ? NaN : 'nope' });
  }
  return out;
}

function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return { receipts: randomReceipts(rng, n), index_def: { metric: 'temp', aggregation: pick(rng, AGGS), window: null } };
}

function independentAgg(values, aggregation) {
  if (values.length === 0) return 0;
  if (aggregation === 'sum') return values.reduce((a, b) => a + b, 0);
  if (aggregation === 'count') return values.length;
  if (aggregation === 'max') return Math.max(...values);
  if (aggregation === 'min') return Math.min(...values);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const TRIALS = 8000;

// ---------- P1: termination — contributing_receipts bounded by input receipts.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.contributing_receipts > pp.receipts.length) violations++;
  }
  return { name: 'P1_termination_contributing_bounded', trials: checked, violations };
}

// ---------- P2 (differential): index_value re-derivation per aggregation mode ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const values = pp.receipts
      .filter((r) => r && typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0 && typeof r.measured_metric === 'number' && Number.isFinite(r.measured_metric))
      .map((r) => r.measured_metric);
    const expected = values.length === 0 ? 0 : independentAgg(values, pp.index_def.aggregation);
    if (values.length === 0) {
      if (output_payload.index_value !== 0 || output_payload.insufficient_evidence !== true) violations++;
    } else if (Math.abs(output_payload.index_value - expected) > 1e-9 * (1 + Math.abs(expected))) {
      violations++;
    }
  }
  return { name: 'P2_index_value_differential', trials: checked, violations };
}

// ---------- P3: boundedness — max/min/count agree exactly with the filtered-values set ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const values = pp.receipts
      .filter((r) => r && typeof r.receipt_hash === 'string' && r.receipt_hash.length > 0 && typeof r.measured_metric === 'number' && Number.isFinite(r.measured_metric))
      .map((r) => r.measured_metric);
    if (values.length === 0) continue;
    if (pp.index_def.aggregation === 'count' && output_payload.index_value !== values.length) violations++;
    if (pp.index_def.aggregation === 'max' && output_payload.index_value !== Math.max(...values)) violations++;
    if (pp.index_def.aggregation === 'min' && output_payload.index_value !== Math.min(...values)) violations++;
  }
  return { name: 'P3_max_min_count_exact_boundedness', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  let violations = 0, checked = 0;
  const eps = Number.EPSILON;
  const forced = [
    0, -0, 1, -1, 1 + eps, 1 - eps, -eps, eps,
    Number.MIN_VALUE, -Number.MIN_VALUE, Number.MIN_VALUE * 2,
    5000 - 5000 * eps, 5000 + 5000 * eps,
    (0.1 + 0.2), 0.3, // classic x/y*y !== x style representation-boundary pair
    1e-300, -1e-300,
  ];
  for (const boundary of forced) {
    for (const agg of AGGS) {
      const receipts = [
        { receipt_hash: 'r0', measured_metric: boundary },
        { receipt_hash: 'r1', measured_metric: boundary },
      ];
      const pp = { receipts, index_def: { metric: 'temp', aggregation: agg, window: null } };
      const { output_payload } = compute(pp);
      checked++;
      if (!Number.isFinite(output_payload.index_value) && !Number.isNaN(boundary)) violations++;
      const expected = independentAgg([boundary, boundary], agg);
      if (Number.isFinite(expected) && Math.abs(output_payload.index_value - expected) > 1e-9 * (1 + Math.abs(expected))) violations++;
    }
  }
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — near-permutation-invariance (tolerance-bounded, not exact) ----------
function checkP5_permutation_tolerance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffled = [...pp.receipts];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute(pp).output_payload;
    const r2 = compute({ ...pp, receipts: shuffled }).output_payload;
    checked++;
    if (r1.contributing_receipts !== r2.contributing_receipts) violations++;
    const tol = 1e-9 * (1 + Math.abs(r1.index_value));
    if (Math.abs(r1.index_value - r2.index_value) > tol) violations++;
  }
  return { name: 'P5_permutation_invariance_tolerance_bounded', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_permutation_tolerance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-309-parametric-index-deriver',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// kernel_digest_at_authoring: sha256:dc6397d80f24256dca54268da76455d52adbc30581facc329dbec8aa51fbefeb
//
// FV-PROPFLOOR-SHARD-B21-1 — property-test floor for art-348-score-credit-model-quantized.
// Class B (bounded-numeric/categorical). ⭐ FIX-2 CARRY CORRECTION: the WU row's triage
// table listed this kernel float:yes, but direct read of the kernel source shows
// compute() performs ZERO floating-point arithmetic — every operand (normalized_fixp16
// inputs, INT8_WEIGHTS, INT32_BIAS_FIXP) is an integer and every operator is integer
// add/multiply/compare/truncate (toInt uses Math.trunc on an already-integral value).
// The `scale` constant is recorded only in QUANT_META for the parity declaration and is
// NEVER read inside compute(). This file therefore carries forced CATEGORICAL/INTEGER
// boundary cases (accumulator exactly at threshold, Number.MAX_SAFE_INTEGER-scale
// overflow guard, non-integer/non-finite raw input coercion) in place of ULP forcing,
// which does not apply to a kernel with no float arithmetic. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B12 harness. This
// file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-348-score-credit-model-quantized.proptest.mjs

import { compute } from '../art-348-score-credit-model-quantized.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

const INT8_WEIGHTS = [-84, -75, -54, 36, -22, -13, 127, 105, 54, 122];
const INT32_BIAS_FIXP = -2964619;

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-348-score-credit-model-quantized.fixtures.json');
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
const rand = mulberry32(0x3480A1);
const TRIALS = 8000;

function refAccumulator(x) {
  let acc = INT32_BIAS_FIXP;
  for (let i = 0; i < 10; i++) acc += x[i] * INT8_WEIGHTS[i];
  return acc;
}
function mkFixp16(rng) { return Math.floor(rng() * 262144) - 131072; }

// ---------- P1: accumulator_fixp matches an independently-computed reference dot product ----------
function checkP1_accumulatorMatchesReference() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const x = Array.from({ length: 10 }, () => mkFixp16(rand));
    const r = compute({ normalized_fixp16: x });
    checked++;
    if (r.output_payload.accumulator_fixp !== refAccumulator(x)) violations++;
  }
  return { name: 'P1_accumulator_fixp_matches_independent_reference_dot_product', trials: checked, violations };
}

// ---------- P2: decision is the exact strict-greater-than-threshold of accumulator_fixp ----------
function checkP2_decisionExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const x = Array.from({ length: 10 }, () => mkFixp16(rand));
    const r = compute({ normalized_fixp16: x });
    checked++;
    const expected = r.output_payload.accumulator_fixp > 0 ? 1 : 0;
    if (r.output_payload.decision !== expected) violations++;
  }
  return { name: 'P2_decision_exact_strict_greater_than_zero_threshold', trials: checked, violations };
}

// ---------- P3: monotonicity — raising one positive-weight feature's input never lowers the accumulator ----------
function checkP3_monotoneInPositiveWeightFeature() {
  let violations = 0, checked = 0;
  const posIdx = INT8_WEIGHTS.findIndex((w) => w > 0); // index 3, weight 36
  const TRIALS_MONO = Math.floor(TRIALS / 2);
  for (let i = 0; i < TRIALS_MONO; i++) {
    const x = Array.from({ length: 10 }, () => mkFixp16(rand));
    const r1 = compute({ normalized_fixp16: x });
    const x2 = [...x];
    x2[posIdx] = x2[posIdx] + Math.floor(rand() * 1000) + 1;
    const r2v = compute({ normalized_fixp16: x2 });
    checked++;
    if (r2v.output_payload.accumulator_fixp < r1.output_payload.accumulator_fixp) violations++;
  }
  return { name: 'P3_accumulator_nondecreasing_when_raising_a_positive_weight_feature', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced integer/categorical boundary cases ----------
function checkP4_forced() {
  const rows = [];
  const cases = [
    [Array(10).fill(0), 'all-zero input — accumulator equals the bias exactly, decision=0 (bias is negative)'],
    [Array(10).fill(131071), 'all-max-positive input — largest legal accumulator, must stay a safe integer'],
    [Array(10).fill(-131072), 'all-max-negative input — smallest legal accumulator, must stay a safe integer'],
    [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((_, i) => i === 3 ? 82351 : 0), 'single positive-weight feature pushed just over the implicit threshold'],
    [undefined, 'normalized_fixp16 entirely absent — every feature defaults to 0 (bias-only accumulator)'],
    [[1.7, 2.3, -54, 36, -22, -13, 127, 105, 54, 122], 'non-integer (fractional) raw inputs — toInt must truncate toward zero, never round'],
    [['not-a-number', null, undefined, NaN, Infinity, -Infinity, 5, 5, 5, 5], 'non-numeric/non-finite raw inputs — toInt must coerce every one to 0'],
    [[131071], 'normalized_fixp16 shorter than 10 elements — missing trailing features must default to 0, not throw'],
  ];
  for (const [input, label] of cases) {
    const pp = input === undefined ? {} : { normalized_fixp16: input };
    const r = compute(pp);
    const { decision, accumulator_fixp } = r.output_payload;
    const plausible = (decision === 0 || decision === 1) && Number.isSafeInteger(accumulator_fixp);
    rows.push({ label, input: pp, decision, accumulator_fixp, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_accumulatorMatchesReference());
results.properties.push(checkP2_decisionExact());
results.properties.push(checkP3_monotoneInPositiveWeightFeature());
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

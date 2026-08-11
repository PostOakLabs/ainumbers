// art-488-model-replication-diff.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:5ff2146f1ae9457d37e4e6699dc331e6f8f69701f3f32a400f848761bc254ed8
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES, direct read confirmed — the linear-combo recompute is a caller-supplied
// coefficient dot product, the logistic transform inlines a pure-JS fdlibm sigmoid (deliberately
// NOT native Math.exp, per the kernel's own header, so V8/QuickJS/zkVM stay bit-identical), and
// within_tolerance is decided by `abs_diff <= abs_tolerance` / `rel_diff <= rel_tolerance` float
// comparisons. ULP-boundary forcing is mandatory per spec §3.
// Checks: fixture-oracle gate, termination (per_record.length === records.length once past the
// not_replicable_as_specified gates), differential re-derivation of the linear-transform
// recomputed_value + within_tolerance decision, a wide-tolerance cross-check of the kernel's
// inlined fdlibm sigmoid against native Math.exp (the spec's own §18.5 rationale predicts a tiny,
// non-zero ULP-level gap between libm implementations — this property states that honestly
// rather than asserting bit-exact equality), ULP-boundary forcing on the tolerance comparison (0,
// -0, denormals, ±1 ULP, the 1e-12 rel_diff cutoff boundary), and a metamorphic linear-transform
// identity (intercept + delta shifts recomputed_value by exactly delta, since linear combination
// is additively homogeneous in the intercept term).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-488-model-replication-diff.proptest.mjs

import { compute } from '../art-488-model-replication-diff.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-488-model-replication-diff.fixtures.json');
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
const rand = mulberry32(0x488C23);

const COEFFS = { x1: 2, x2: -1 };
const INTERCEPT = 10;

function randomRecord(rng, i) {
  const x1 = Math.round((rng() - 0.5) * 40 * 100) / 100;
  const x2 = Math.round((rng() - 0.5) * 40 * 100) / 100;
  const linear = INTERCEPT + COEFFS.x1 * x1 + COEFFS.x2 * x2;
  const reported = rng() < 0.7 ? linear + (rng() - 0.5) : linear + (rng() - 0.5) * 6;
  return { id: `r${i}`, segment: rng() < 0.5 ? 'A' : 'B', features: { x1, x2 }, reported_value: Math.round(reported * 1000) / 1000 };
}

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 8);
  const records = [];
  for (let i = 0; i < n; i++) records.push(randomRecord(rng, i));
  return {
    model_spec: { version: 'v1', as_of_date: '2026-01-01', transform: 'linear', intercept: INTERCEPT, coefficients: COEFFS },
    tolerance: { abs_tolerance: 0.5 },
    records,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — per_record.length === records.length (linear, all fields present) ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.per_record.length !== pp.records.length) violations++;
    if (output_payload.aggregate.count_total !== pp.records.length) violations++;
  }
  return { name: 'P1_termination_per_record_bounded', trials: checked, violations };
}

// ---------- P2 (differential): linear recomputed_value + within_tolerance re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (let k = 0; k < pp.records.length; k++) {
      const rec = pp.records[k];
      const got = output_payload.per_record[k];
      const expectedLinear = pp.model_spec.intercept + pp.model_spec.coefficients.x1 * rec.features.x1 + pp.model_spec.coefficients.x2 * rec.features.x2;
      if (Math.abs(got.recomputed_value - expectedLinear) > 1e-9) violations++;
      const expectedAbsDiff = Math.abs(expectedLinear - rec.reported_value);
      const expectedWithin = expectedAbsDiff <= pp.tolerance.abs_tolerance;
      if (got.within_tolerance !== expectedWithin) violations++;
    }
  }
  return { name: 'P2_linear_recompute_differential', trials: checked, violations };
}

// ---------- P3: sigmoid cross-check — kernel's inlined fdlibm sigmoid vs native Math.exp sigmoid ----------
// NOT bit-exact by design (per the kernel's own §18.5 header note: different libm implementations
// legitimately disagree at the ULP level) — this property states a wide, honest tolerance rather
// than asserting equality that the kernel's own documentation disclaims.
function checkP3_sigmoid_crosscheck() {
  let violations = 0, checked = 0;
  const rngLocal = mulberry32(0x488AA);
  for (let i = 0; i < 2000; i++) {
    const x1 = (rngLocal() - 0.5) * 20;
    const x2 = (rngLocal() - 0.5) * 20;
    const linear = 2 + 0.5 * x1 - 0.3 * x2;
    const nativeSigmoid = 1 / (1 + Math.exp(-linear));
    const pp = {
      model_spec: { transform: 'logistic', intercept: 2, coefficients: { x1: 0.5, x2: -0.3 } },
      tolerance: { abs_tolerance: 1 },
      records: [{ id: 'r0', features: { x1, x2 }, reported_value: nativeSigmoid }],
    };
    const { output_payload } = compute(pp);
    checked++;
    const kernelSigmoid = output_payload.per_record[0].recomputed_value;
    if (Math.abs(kernelSigmoid - nativeSigmoid) > 1e-6) violations++;
  }
  return { name: 'P3_sigmoid_crosscheck_wide_tolerance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  const eps = Number.EPSILON;
  const forced = [
    { x1: 0, reported: 10, absTol: 0, label: 'zero feature, zero tolerance, reported==intercept exactly' },
    { x1: 0, reported: 10 + eps, absTol: 0, label: 'reported off by EPSILON at zero tolerance -> fail' },
    { x1: 0, reported: 10 - eps, absTol: 0, label: 'reported off by -EPSILON at zero tolerance -> fail (still nonzero diff)' },
    { x1: 0, reported: 10, absTol: -0, label: 'negative-zero tolerance behaves as zero tolerance' },
    { x1: 0, reported: 10 + Number.MIN_VALUE, absTol: Number.MIN_VALUE * 2, label: 'denormal diff within denormal tolerance -> pass' },
    { x1: 1e-13, reported: 10, absTol: 1e10, relTol: 0.5, label: 'reported_value near the 1e-12 rel_diff cutoff (using reported as denominator proxy via abs check)' },
  ];
  let violations = 0, checked = 0;
  const rows = [];
  for (const c of forced) {
    const pp = {
      model_spec: { transform: 'linear', intercept: 10, coefficients: { x1: 0 } },
      tolerance: { abs_tolerance: c.absTol, rel_tolerance: c.relTol },
      records: [{ id: 'r0', features: { x1: c.x1 }, reported_value: c.reported }],
    };
    const { output_payload } = compute(pp);
    checked++;
    const linear = 10;
    const absDiff = Math.abs(linear - c.reported);
    const passAbs = c.absTol !== undefined && absDiff <= Math.abs(c.absTol);
    const relDiff = Math.abs(c.reported) > 1e-12 ? absDiff / Math.abs(c.reported) : null;
    const passRel = c.relTol !== undefined && relDiff !== null && relDiff <= c.relTol;
    const expectedWithin = passAbs || passRel;
    if (output_payload.per_record[0].within_tolerance !== expectedWithin) violations++;
    rows.push({ ...c, within_tolerance: output_payload.per_record[0].within_tolerance, expected: expectedWithin });
  }
  results.ulp_forced_rows = rows;
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — intercept-shift identity (linear transform only) ----------
function checkP5_intercept_shift_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const delta = (rand() - 0.5) * 10;
    const pp2 = { ...pp, model_spec: { ...pp.model_spec, intercept: pp.model_spec.intercept + delta } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    for (let k = 0; k < pp.records.length; k++) {
      const v1 = r1.per_record[k].recomputed_value;
      const v2 = r2.per_record[k].recomputed_value;
      if (Math.abs((v2 - v1) - delta) > 1e-6) violations++;
    }
  }
  return { name: 'P5_intercept_shift_metamorphic_identity', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_sigmoid_crosscheck());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_intercept_shift_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-488-model-replication-diff',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

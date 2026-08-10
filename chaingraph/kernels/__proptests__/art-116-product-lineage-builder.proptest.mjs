// art-116-product-lineage-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:c90285303f490a09ce2e73fc197bc99fb23ca31e2db96426f18f373ba021c574
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES — ULP-boundary forcing mandatory (carbon_value summation edge cases: 0, negative
// zero, denormal-scale values, and the toFixed-style 1e6 rounding boundary).
// Checks: fixture-oracle gate, termination (lineage.length === depth === stages.length), boundedness
// (total_carbon finite, no NaN), broken/compliance_flags differential re-derivation, metamorphic
// commutativity of total_carbon under stage-array permutation, and ULP-forced carbon-value cases.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-116-product-lineage-builder.proptest.mjs

import { compute } from '../art-116-product-lineage-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-116-product-lineage-builder.fixtures.json');
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
const rand = mulberry32(0xA16A1);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomStage(rng, i) {
  return {
    stage: `stage-${i}`,
    supplier_hash: rng() < 0.7 ? `sha256:${'a'.repeat(64)}` : 'unhashed-ref',
    certification: rng() < 0.5 ? 'ISO14001' : null,
    dataVersion: '2026-01',
    carbon_value: randRange(rng, 0, 100),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — lineage.length === depth === input stages.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = randInt(rand, 0, 40);
    const stages = Array.from({ length: n }, (_, idx) => randomStage(rand, idx));
    const { output_payload } = compute({ product_id: 'P1', stages });
    checked++;
    if (output_payload.lineage.length !== n) violations++;
    if (output_payload.depth !== n) violations++;
  }
  return { name: 'P1_termination_lineage_length', trials: checked, violations };
}

// ---------- P2: boundedness — total_carbon always finite, never NaN ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 0, 10);
    const stages = Array.from({ length: n }, (_, idx) => randomStage(rand, idx));
    const { output_payload } = compute({ product_id: 'P1', stages });
    checked++;
    if (!Number.isFinite(output_payload.total_carbon)) violations++;
  }
  return { name: 'P2_boundedness_total_carbon_finite', trials: checked, violations };
}

// ---------- P3 (differential): broken / compliance_flags re-derivation from anchored status ----------
function checkP3_broken_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = randInt(rand, 1, 8);
    const stages = Array.from({ length: n }, (_, idx) => randomStage(rand, idx));
    const { output_payload, compliance_flags } = compute({ product_id: 'P1', stages });
    checked++;
    const expectedBroken = output_payload.lineage.some((l) => !l.anchored);
    if (expectedBroken && !compliance_flags.includes('LINEAGE_UNANCHORED_STAGE')) violations++;
    if (!expectedBroken && !compliance_flags.includes('LINEAGE_FULLY_ANCHORED')) violations++;
    // anchored must agree with the input's own supplier_hash prefix test
    output_payload.lineage.forEach((l, idx) => {
      const expectedAnchored = typeof stages[idx].supplier_hash === 'string' && stages[idx].supplier_hash.startsWith('sha256:');
      if (l.anchored !== expectedAnchored) violations++;
    });
  }
  return { name: 'P3_broken_flags_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — total_carbon is commutative under stage-array permutation ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const n = randInt(rand, 2, 10);
    const stages = Array.from({ length: n }, (_, idx) => randomStage(rand, idx));
    const r1 = compute({ product_id: 'P1', stages }).output_payload;
    const r2 = compute({ product_id: 'P1', stages: shuffle(rand, stages) }).output_payload;
    checked++;
    if (Math.abs(r1.total_carbon - r2.total_carbon) > 1e-6) violations++;
    if (r1.depth !== r2.depth) violations++;
  }
  return { name: 'P4_permutation_invariance_total_carbon', trials: checked, violations };
}

// ---------- P5 (ULP-forcing, float_sensitive:yes) — carbon_value summation edge cases ----------
const ULP_BOUNDARY_CASES = [
  { stages: [{ stage: 's1', supplier_hash: 'sha256:' + 'a'.repeat(64), carbon_value: 0.1 }, { stage: 's2', supplier_hash: 'sha256:' + 'b'.repeat(64), carbon_value: 0.2 }], expected: 0.3, label: '0.1+0.2 -> rounded to exactly 0.3 (1e6 rounding absorbs the float remainder)' },
  { stages: [{ stage: 's1', supplier_hash: 'sha256:' + 'a'.repeat(64), carbon_value: -0 }], expected: 0, label: 'negative-zero carbon_value -> total rounds to (positive) zero' },
  { stages: [{ stage: 's1', supplier_hash: 'sha256:' + 'a'.repeat(64), carbon_value: 1e-300 }], expected: 0, label: 'near-subnormal carbon_value -> rounds to 0 at 1e-6 precision, stays finite' },
  { stages: [{ stage: 's1', supplier_hash: 'sha256:' + 'a'.repeat(64), carbon_value: 0 }], expected: 0, label: 'zero carbon_value -> total exactly 0' },
  { stages: [], expected: 0, label: 'empty stages array -> total_carbon 0, depth 0' },
];
function checkP5_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const { output_payload } = compute({ product_id: 'P1', stages: c.stages });
    rows.push({
      label: c.label,
      total_carbon: output_payload.total_carbon,
      finite: Number.isFinite(output_payload.total_carbon),
      matches_expected: Object.is(output_payload.total_carbon, c.expected) || output_payload.total_carbon === c.expected,
    });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_broken_differential());
results.properties.push(checkP4_permutation_invariance());
results.boundary_forced = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite || !b.matches_expected);

console.log(JSON.stringify({
  tool_id: 'art-116-product-lineage-builder',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);

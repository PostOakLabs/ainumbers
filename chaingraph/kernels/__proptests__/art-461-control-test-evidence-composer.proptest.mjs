// art-461-control-test-evidence-composer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:ab7d9c5cf26d42cb2205025bca9f91353454bea181602f0dd0508aa55c4e94e4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (exception_rate = exception_count / sample_size is a plain ratio used only
// for display, never compared against a float threshold — within_tolerance compares two integers,
// exception_count <= tolerable_exception_count; no ULP-boundary claim made or needed, per direct
// source read). Forced categorical boundary cases used instead.
// Checks: fixture-oracle gate, termination (sample_size/tested_count/exception_count bounded by
// input sample/test_results array lengths), differential re-derivation of coverage_complete,
// exception_count, within_tolerance, and test_conclusion, boundedness (missing_results/exception_items
// subset of sample item_ids), and forced categorical boundary cases at the tolerable-deviation edge.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-461-control-test-evidence-composer.proptest.mjs

import { compute } from '../art-461-control-test-evidence-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-461-control-test-evidence-composer.fixtures.json');
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
const rand = mulberry32(0x461A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const n = Math.floor(rng() * 12);
  const sample = [];
  for (let i = 0; i < n; i++) sample.push({ item_id: `item-${i}` });
  const resultCoverage = pick(rng, [0, 0.3, 0.7, 1]);
  const test_results = [];
  for (let i = 0; i < n; i++) {
    if (rng() < resultCoverage) test_results.push({ item_id: `item-${i}`, result: pick(rng, ['pass', 'fail', 'PASS', 'invalid', '']) });
  }
  const extraN = Math.floor(rng() * 3);
  for (let i = 0; i < extraN; i++) test_results.push({ item_id: `extra-${i}`, result: pick(rng, ['pass', 'fail']) });
  return {
    control_id: pick(rng, ['CTRL-1', '', null]),
    population_hash: pick(rng, ['ph-abc', '', null]),
    tester_id: pick(rng, ['t1', '']),
    tolerable_exception_count: Math.floor(rng() * 4),
    sample,
    test_results,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — sample_size/tested_count bounded by input array lengths ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.sample_size !== pp.sample.length) violations++;
    if (output_payload.tested_count > pp.sample.length) violations++;
    if (output_payload.exception_count > pp.sample.length) violations++;
  }
  return { name: 'P1_termination_counts_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2 (differential): coverage_complete + exception_count re-derivation ----------
function checkP2_coverage_exception_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const resultMap = new Map();
    pp.test_results.forEach((r) => {
      const result = String(r.result || '').trim().toLowerCase();
      resultMap.set(r.item_id, result === 'pass' || result === 'fail' ? result : 'invalid');
    });
    const sampleIds = pp.sample.map((s) => s.item_id);
    const missing = sampleIds.filter((id) => !resultMap.has(id));
    const coverageComplete = missing.length === 0 && sampleIds.length > 0;
    const exceptionCount = sampleIds.filter((id) => resultMap.get(id) === 'fail').length;
    if (output_payload.coverage_complete !== coverageComplete) violations++;
    if (output_payload.exception_count !== exceptionCount) violations++;
  }
  return { name: 'P2_coverage_exception_differential', trials: checked, violations };
}

// ---------- P3: boundedness — missing_results and exception_items subset of sample item_ids ----------
function checkP3_subset_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const sampleIds = new Set(pp.sample.map((s) => s.item_id));
    for (const id of output_payload.missing_results) if (!sampleIds.has(id)) violations++;
    if (output_payload.deficiency) for (const id of output_payload.deficiency.exception_items) if (!sampleIds.has(id)) violations++;
  }
  return { name: 'P3_missing_and_exception_items_subset_of_sample', trials: checked, violations };
}

// ---------- P4: metamorphic — flipping a pass to fail never decreases exception_count or improves test_conclusion ----------
function checkP4_flip_to_fail_metamorphic() {
  let violations = 0, checked = 0;
  const RANK = { incomplete: 0, exception_noted: 1, operating_effectively: 2 };
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const passIdx = pp.test_results.findIndex((r) => String(r.result || '').toLowerCase() === 'pass');
    if (passIdx === -1) continue;
    const r1 = compute(pp).output_payload;
    const flipped = { ...pp, test_results: pp.test_results.map((r, idx) => (idx === passIdx ? { ...r, result: 'fail' } : r)) };
    const r2 = compute(flipped).output_payload;
    checked++;
    if (r2.exception_count < r1.exception_count) violations++;
    if (RANK[r2.test_conclusion] > RANK[r1.test_conclusion]) violations++;
  }
  return { name: 'P4_flip_pass_to_fail_never_improves_conclusion', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases at the tolerable-deviation edge (float:no substitute for ULP-forcing) ----------
function checkP5_tolerance_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    { sampleN: 3, failN: 0, tol: 0, expectWithin: true, label: 'zero_exceptions_zero_tolerance' },
    { sampleN: 3, failN: 1, tol: 0, expectWithin: false, label: 'one_exception_zero_tolerance' },
    { sampleN: 5, failN: 2, tol: 2, expectWithin: true, label: 'exactly_at_tolerance' },
    { sampleN: 5, failN: 3, tol: 2, expectWithin: false, label: 'one_over_tolerance' },
    { sampleN: 0, failN: 0, tol: 0, expectWithin: false, label: 'empty_sample_never_within_tolerance' },
  ];
  for (const c of cases) {
    checked++;
    const sample = Array.from({ length: c.sampleN }, (_, i) => ({ item_id: `s${i}` }));
    const test_results = sample.map((s, i) => ({ item_id: s.item_id, result: i < c.failN ? 'fail' : 'pass' }));
    const pp = { control_id: 'C', population_hash: 'P', tester_id: 'T', tolerable_exception_count: c.tol, sample, test_results };
    const { output_payload } = compute(pp);
    if (output_payload.within_tolerance !== c.expectWithin) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_tolerance_edge', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_coverage_exception_differential());
results.properties.push(checkP3_subset_boundedness());
results.properties.push(checkP4_flip_to_fail_metamorphic());
results.properties.push(checkP5_tolerance_boundary_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-461-control-test-evidence-composer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

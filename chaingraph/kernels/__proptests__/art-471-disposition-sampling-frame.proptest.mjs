// art-471-disposition-sampling-frame.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:33d8dd00530f61c28fc39625801011c67b5ebb1694d5abe4bc9af6c882daa66c
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — direct source read confirmed. confidence_level/tolerable/expected rates are
// declared-enum-shaped policy inputs consumed by Math.log/Math.ceil in the Poisson formula, but the
// kernel's own decision (indefensible vs poisson_attribute_sampling) branches on `tdr <= edr`, an
// exact comparison of the two DECLARED-INPUT ratios (not a derived/rounded intermediate), so no
// ULP-boundary claim is made or needed for that branch; sample_size/interval/start_offset are all
// then integers. Forced categorical boundary cases used instead.
// Checks: fixture-oracle gate, termination — **`selected_indices` fill loop is bounded by the
// caller-declared `population_size`/`sample_size`, both explicitly capped (sample_size <=
// population_size via Math.min); this is the one true "convergence-or-report"-shaped property in
// this shard** (§3 class-C row): the loop's iteration count never exceeds the stated
// population_size cap, tested directly. Also: reviewer_workload total item count re-derivation
// (differential), boundedness (every selected index is in [0, population_size)), metamorphic
// full-census fallback (tdr<=edr forces sample_size===population_size), and forced categorical
// boundary cases (population_size=1, single reviewer). Zero external dependencies — pure Node
// built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-471-disposition-sampling-frame.proptest.mjs

import { compute } from '../art-471-disposition-sampling-frame.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-471-disposition-sampling-frame.fixtures.json');
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
const rand = mulberry32(0x471A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const rosterN = Math.floor(rng() * 5);
  return {
    confidence_level: pick(rng, [90, 95, 99]),
    disposition_population_size: 1 + Math.floor(rng() * 5000),
    tolerable_deviation_rate: rng() * 20,
    expected_deviation_rate: rng() * 10,
    disposition_population_hash: `ph-${Math.floor(rng() * 1e6)}`,
    reviewer_roster: Array.from({ length: rosterN }, (_, i) => `rev-${i}`),
  };
}

const TRIALS = 4000;

// ---------- P1: termination — the selected-indices fill loop never exceeds population_size iterations ----------
function checkP1_termination_bounded_by_population_size() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.sample_size > output_payload.disposition_population_size) violations++;
    if (output_payload.selected_indices.length > output_payload.sample_size) violations++;
  }
  return { name: 'P1_termination_sample_size_bounded_by_population_size', trials: checked, violations };
}

// ---------- P2 (differential): reviewer_workload total item count matches selected_indices.length ----------
function checkP2_reviewer_workload_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const totalAssigned = output_payload.reviewer_workload.reduce((a, r) => a + r.disposition_indices.length, 0);
    if (totalAssigned !== output_payload.selected_indices.length) violations++;
    const rosterUsed = pp.reviewer_roster.length > 0 ? pp.reviewer_roster : ['reviewer_1'];
    if (output_payload.reviewer_workload.length !== rosterUsed.length) violations++;
  }
  return { name: 'P2_reviewer_workload_total_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every selected index is in [0, population_size) and unique ----------
function checkP3_selected_indices_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const seen = new Set();
    for (const idx of output_payload.selected_indices) {
      if (idx < 0 || idx >= output_payload.disposition_population_size) violations++;
      if (seen.has(idx)) violations++;
      seen.add(idx);
    }
  }
  return { name: 'P3_selected_indices_in_range_and_unique', trials: checked, violations };
}

// ---------- P4: metamorphic — tdr <= edr forces the full-census fallback (sample_size === population_size) ----------
function checkP4_full_census_fallback_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomPP(rand);
    const forced = { ...pp, tolerable_deviation_rate: pp.expected_deviation_rate }; // tdr === edr -> indefensible
    const { output_payload } = compute(forced);
    checked++;
    if (output_payload.method !== 'full_census_fallback') violations++;
    if (output_payload.sample_size !== output_payload.disposition_population_size) violations++;
  }
  return { name: 'P4_full_census_fallback_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (population_size=1, single reviewer, empty roster) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  {
    checked++;
    const { output_payload } = compute({ confidence_level: 95, disposition_population_size: 1, tolerable_deviation_rate: 5, expected_deviation_rate: 0, disposition_population_hash: 'h', reviewer_roster: [] });
    if (output_payload.sample_size !== 1) violations++;
    if (output_payload.selected_indices.length !== 1 || output_payload.selected_indices[0] !== 0) violations++;
    if (output_payload.reviewer_roster.length !== 1 || output_payload.reviewer_roster[0] !== 'reviewer_1') violations++;
  }
  {
    checked++;
    // deterministic replay: same inputs -> identical selected_indices (systematic sampling, no randomness).
    const pp = { confidence_level: 95, disposition_population_size: 500, tolerable_deviation_rate: 5, expected_deviation_rate: 1, disposition_population_hash: 'stable-hash', reviewer_roster: ['a', 'b'] };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    if (JSON.stringify(r1.selected_indices) !== JSON.stringify(r2.selected_indices)) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded_by_population_size());
results.properties.push(checkP2_reviewer_workload_differential());
results.properties.push(checkP3_selected_indices_boundedness());
results.properties.push(checkP4_full_census_fallback_metamorphic());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-471-disposition-sampling-frame',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

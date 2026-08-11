// art-475-cfpb-1071-coverage-check.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:0ef028be15ca148086aa48b2fc87b6f735c14233206ae951b0d1c8f285b98c72
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (Math.trunc + integer >= comparisons against a fixed integer THRESHOLD=1000;
// no ratio math, direct source read confirmed — kernel's own header states "no NaN/Infinity
// surface"). Forced categorical boundary cases used instead.
// Checks: fixture-oracle gate, termination (sblar_records output bounded by input array length),
// differential re-derivation of `covered` and per-record `valid`/missing_fields, boundedness
// (present_fields_count + missing_fields.length === required_fields_count always), forced
// categorical boundary cases at the THRESHOLD=1000 edge (999/1000/1001), and metamorphic
// append-invariance for sblar_records. Zero external dependencies — pure Node built-ins only
// (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-475-cfpb-1071-coverage-check.proptest.mjs

import { compute } from '../art-475-cfpb-1071-coverage-check.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-475-cfpb-1071-coverage-check.fixtures.json');
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
const rand = mulberry32(0x475A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CANDIDATE_FIELDS = ['loan_amount', 'naics_code', 'action_taken', 'pricing', 'ethnicity'];

function randomRecord(rng, requiredFields) {
  const fields = {};
  for (const f of requiredFields) {
    if (rng() < 0.7) fields[f] = pick(rng, ['x', 1, true]);
  }
  return { record_id: `r-${Math.floor(rng() * 1e6)}`, fields };
}

function randomPP(rng) {
  const requiredN = Math.floor(rng() * 5);
  const required_sblar_fields = CANDIDATE_FIELDS.slice(0, requiredN);
  const recordN = Math.floor(rng() * 8);
  const sblar_records = [];
  for (let i = 0; i < recordN; i++) sblar_records.push(randomRecord(rng, required_sblar_fields));
  return {
    originations_year1_count: Math.floor(rng() * 2000) - 500,
    originations_year2_count: Math.floor(rng() * 2000) - 500,
    required_sblar_fields,
    sblar_records,
  };
}

const TRIALS = 5000;

// ---------- P1: termination — sblar_records output length equals input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.sblar_records.length !== pp.sblar_records.length) violations++;
  }
  return { name: 'P1_termination_records_length_equals_input', trials: checked, violations };
}

// ---------- P2 (differential): covered + per-record valid re-derivation ----------
function checkP2_covered_and_valid_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const y1 = Math.max(0, Math.trunc(Number(pp.originations_year1_count) || 0));
    const y2 = Math.max(0, Math.trunc(Number(pp.originations_year2_count) || 0));
    const expectedCovered = y1 >= 1000 && y2 >= 1000;
    if (output_payload.covered !== expectedCovered) violations++;
    output_payload.sblar_records.forEach((rec, idx) => {
      const srcFields = pp.sblar_records[idx].fields || {};
      const missing = pp.required_sblar_fields.filter((f) => !(f in srcFields) || srcFields[f] === undefined || srcFields[f] === null || (typeof srcFields[f] === 'string' && srcFields[f].trim() === ''));
      const expectedValid = missing.length === 0;
      if (rec.valid !== expectedValid) violations++;
    });
  }
  return { name: 'P2_covered_and_valid_differential', trials: checked, violations };
}

// ---------- P3: boundedness — present_fields_count + missing_fields.length === required_fields_count ----------
function checkP3_field_count_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const rec of output_payload.sblar_records) {
      if (rec.present_fields_count + rec.missing_fields.length !== rec.required_fields_count) violations++;
      if (rec.required_fields_count !== pp.required_sblar_fields.length) violations++;
    }
  }
  return { name: 'P3_present_plus_missing_equals_required', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases at THRESHOLD=1000 ----------
function checkP4_threshold_boundary_categorical() {
  let violations = 0, checked = 0;
  const cases = [
    { y1: 999, y2: 1000, expected: false, label: 'y1_just_below' },
    { y1: 1000, y2: 999, expected: false, label: 'y2_just_below' },
    { y1: 1000, y2: 1000, expected: true, label: 'both_exactly_at' },
    { y1: 1001, y2: 1001, expected: true, label: 'both_just_above' },
    { y1: 0, y2: 0, expected: false, label: 'both_zero' },
  ];
  for (const c of cases) {
    checked++;
    const { output_payload } = compute({ originations_year1_count: c.y1, originations_year2_count: c.y2, required_sblar_fields: [], sblar_records: [] });
    if (output_payload.covered !== c.expected) violations++;
  }
  return { name: 'P4_forced_categorical_threshold_boundary', trials: checked, violations };
}

// ---------- P5: metamorphic — appending a record never changes an earlier record's validation ----------
function checkP5_append_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.sblar_records.length === 0) continue;
    const r1 = compute(pp).output_payload;
    const extended = { ...pp, sblar_records: [...pp.sblar_records, randomRecord(rand, pp.required_sblar_fields)] };
    const r2 = compute(extended).output_payload;
    checked++;
    for (let j = 0; j < pp.sblar_records.length; j++) {
      if (JSON.stringify(r1.sblar_records[j]) !== JSON.stringify(r2.sblar_records[j])) violations++;
    }
    if (r2.sblar_records.length !== r1.sblar_records.length + 1) violations++;
  }
  return { name: 'P5_append_record_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_covered_and_valid_differential());
results.properties.push(checkP3_field_count_boundedness());
results.properties.push(checkP4_threshold_boundary_categorical());
results.properties.push(checkP5_append_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-475-cfpb-1071-coverage-check',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

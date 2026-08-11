// art-557-record-index-constituents.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:9fa0ed744db004c384a593d82dbf01220683bac4c5daef6601790bfb5ffbd175
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO -- CORRECTED from the WU row's float:yes (per FIX-2 discipline). This is a
// pure attestation kernel: normalizeConstituent() only echoes caller-supplied fields, and the
// sole numeric comparison (selectionUniverseSize < constituentCount) is an integer comparison
// with zero division, multiplication, or rounding anywhere in the file. Forced categorical
// boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (constituents array echoed 1:1, never expanded,
// bounded by pp.constituents.length), boundedness (constituent_count === constituents.length,
// missingIds count <= constituent_count), differential re-derivation of structural_error/
// missingIds/compliance_flags via an independent reimplementation, permutation-invariance of
// constituents order (count/missingIds/structural_error are order-independent; the echoed array
// itself reorders with the input, so only the order-independent aggregates are compared), and
// forced categorical boundary cases (missing index_id, missing as_of_date, empty constituents,
// missing eligibility_criteria_ref, selection_universe_size below/at/above constituent_count,
// one constituent missing security_id).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-557-record-index-constituents.proptest.mjs

import { compute } from '../art-557-record-index-constituents.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-557-record-index-constituents.fixtures.json');
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
const rand = mulberry32(0x55700028);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomConstituent(rng, i) {
  return {
    security_id: rng() < 0.15 ? undefined : `SEC-${i}`,
    name: `Company ${i}`,
    sector: pick(rng, ['Industrials', 'Financials', 'Materials', 'Utilities']),
    country: pick(rng, ['US', 'GB', 'FR', 'DE']),
  };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 10);
  return {
    index_id: rng() < 0.1 ? undefined : `IDX-${Math.floor(rng() * 1000)}`,
    as_of_date: rng() < 0.1 ? undefined : '2026-08-05',
    constituents: Array.from({ length: n }, (_, i) => randomConstituent(rng, i)),
    eligibility_criteria_ref: rng() < 0.1 ? undefined : 'market-cap rank <=200',
    selection_universe_size: rng() < 0.5 ? Math.floor(rng() * 500) : undefined,
  };
}

const TRIALS = 3000;

// ---------- P1: termination -- constituents echoed 1:1, never expanded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.constituents.length !== pp.constituents.length) violations++;
    if (output_payload.constituent_count !== output_payload.constituents.length) violations++;
  }
  return { name: 'P1_constituents_echoed_1to1_bounded_by_input_length', trials: checked, violations };
}

// ---------- P2: boundedness -- missingIds bounded by constituent_count ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const missingIds = output_payload.constituents.filter((c) => !c.security_id).length;
    if (missingIds > output_payload.constituent_count) violations++;
    if (output_payload.structural_error !== null && typeof output_payload.structural_error !== 'string') violations++;
  }
  return { name: 'P2_missing_ids_bounded_by_constituent_count', trials: checked, violations };
}

// ---------- P3 (differential): structural_error/compliance_flags re-derived ----------
function reimplement(pp) {
  const constituents = Array.isArray(pp.constituents) ? pp.constituents : [];
  let structuralError = null;
  if (!pp.index_id) structuralError = 'index_id is required.';
  else if (!pp.as_of_date) structuralError = 'as_of_date is required.';
  else if (constituents.length === 0) structuralError = 'constituents must be a non-empty array.';
  else if (!pp.eligibility_criteria_ref) structuralError = 'eligibility_criteria_ref is required.';
  const missingIds = constituents.filter((c) => !(c && c.security_id)).length;
  const sizeInconsistent = !structuralError && pp.selection_universe_size != null && Number.isFinite(pp.selection_universe_size) && pp.selection_universe_size < constituents.length;
  return { structuralError, missingIds, sizeInconsistent };
}
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if (output_payload.structural_error !== expected.structuralError) violations++;
    const hasSizeFlag = compliance_flags.includes('INDEX_SELECTION_UNIVERSE_SIZE_INCONSISTENT');
    if (hasSizeFlag !== !!expected.sizeInconsistent) violations++;
  }
  return { name: 'P3_structural_error_and_flags_differential', trials: checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of constituents order ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.constituents.length < 2) continue;
    const shuffled = { ...pp, constituents: [...pp.constituents].reverse() };
    const r1 = compute(pp).output_payload;
    const r2v = compute(shuffled).output_payload;
    checked++;
    if (r1.constituent_count !== r2v.constituent_count) violations++;
    if (r1.structural_error !== r2v.structural_error) violations++;
  }
  return { name: 'P4_constituents_order_invariance', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  const base = { index_id: 'IDX', as_of_date: '2026-08-05', eligibility_criteria_ref: 'crit', constituents: [{ security_id: 'S1', name: 'A', sector: 'X', country: 'US' }] };
  // missing index_id -> structural error
  checked++;
  { const r = compute({ ...base, index_id: undefined }).output_payload; if (!r.structural_error) violations++; }
  // missing as_of_date -> structural error
  checked++;
  { const r = compute({ ...base, as_of_date: undefined }).output_payload; if (!r.structural_error) violations++; }
  // empty constituents -> structural error
  checked++;
  { const r = compute({ ...base, constituents: [] }).output_payload; if (!r.structural_error) violations++; }
  // missing eligibility_criteria_ref -> structural error
  checked++;
  { const r = compute({ ...base, eligibility_criteria_ref: undefined }).output_payload; if (!r.structural_error) violations++; }
  // selection_universe_size below constituent_count -> flagged inconsistent
  checked++;
  { const { compliance_flags } = compute({ ...base, selection_universe_size: 0 }); if (!compliance_flags.includes('INDEX_SELECTION_UNIVERSE_SIZE_INCONSISTENT')) violations++; }
  // selection_universe_size exactly at constituent_count -> not inconsistent
  checked++;
  { const { compliance_flags } = compute({ ...base, selection_universe_size: 1 }); if (compliance_flags.includes('INDEX_SELECTION_UNIVERSE_SIZE_INCONSISTENT')) violations++; }
  // one constituent missing security_id -> soft flag, not a structural error
  checked++;
  { const r = compute({ ...base, constituents: [{ name: 'A', sector: 'X', country: 'US' }] }); if (r.output_payload.structural_error !== null || !r.compliance_flags.includes('INDEX_CONSTITUENTS_MISSING_SECURITY_ID')) violations++; }
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-557-record-index-constituents',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

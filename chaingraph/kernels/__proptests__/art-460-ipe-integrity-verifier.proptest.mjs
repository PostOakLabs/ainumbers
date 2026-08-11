// kernel_digest_at_authoring: sha256:3739111ed80b1fdde1f68667060608703b547770fc185678540d7e16fa4023c6
//
// FV-PROPFLOOR-SHARD-B25-1 — property-test floor for art-460-ipe-integrity-verifier.
// Class B (bounded-numeric), float:no per WU — the only float-shaped operation is
// abs(control_total_delta) <= tolerance, a single threshold comparison identical in kind to
// B12's art-316 threshold-string exception. Forced CATEGORICAL boundary cases (delta exactly at
// tolerance, delta one step outside) are used in place of ULP forcing, per FV-PBT-FLOOR-BUILD-
// SPEC.md §3. Zero external dependencies. This file is READ-ONLY with respect to the kernel it
// imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-460-ipe-integrity-verifier.proptest.mjs

import { compute } from '../art-460-ipe-integrity-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-460-ipe-integrity-verifier.fixtures.json');
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
const rand = mulberry32(0x460C3);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
const TRIALS = 10000;

function mkPP(rng) {
  const sameHash = rng() < 0.5;
  const hashA = 'sha256:' + randInt(rng, 0, 1e9);
  const source_extract_hash = hashA;
  const report_hash = sameHash ? hashA : 'sha256:' + randInt(rng, 0, 1e9);
  const sameRows = rng() < 0.5;
  const source_row_count = randInt(rng, 0, 100000);
  const report_row_count = sameRows ? source_row_count : randInt(rng, 0, 100000);
  const source_control_total = randRange(rng, -1e7, 1e7);
  const report_control_total = source_control_total + randRange(rng, -100, 100);
  const tolerance = randRange(rng, 0, 50);
  return { source_extract_hash, report_hash, source_row_count, report_row_count, source_control_total, report_control_total, tolerance };
}

// ---------- P1: fixed rule — integrity_status confirmed iff discrepancies empty ----------
function checkP1_statusMatchesDiscrepancies() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { discrepancies, integrity_status } = r.output_payload;
    const expected = discrepancies.length === 0 ? 'confirmed' : 'exception';
    if (integrity_status !== expected) violations++;
  }
  return { name: 'P1_integrity_status_exact_negation_of_discrepancies', trials: checked, violations };
}

// ---------- P2: fixed rule — hash_match iff both non-empty and equal ----------
function checkP2_hashMatchExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = !!pp.source_extract_hash && !!pp.report_hash && pp.source_extract_hash === pp.report_hash;
    if (r.output_payload.hash_match !== expected) violations++;
    if (!expected && !r.output_payload.discrepancies.includes('HASH_MISMATCH')) violations++;
  }
  return { name: 'P2_hash_match_exact_string_equality', trials: checked, violations };
}

// ---------- P3: fixed rule — total_within_tolerance iff |delta| <= tolerance ----------
function checkP3_toleranceExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { control_total_delta, tolerance, total_within_tolerance } = r.output_payload;
    const expected = Math.abs(control_total_delta) <= tolerance;
    if (total_within_tolerance !== expected) violations++;
  }
  return { name: 'P3_total_within_tolerance_exact_abs_delta_lte_tolerance', trials: checked, violations };
}

// ---------- P4: boundedness — discrepancies subset of the 3 declared codes, integrity_status in enum ----------
function checkP4_bounded() {
  let violations = 0, checked = 0;
  const CODES = new Set(['HASH_MISMATCH', 'ROW_COUNT_MISMATCH', 'CONTROL_TOTAL_OUT_OF_TOLERANCE']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const d of r.output_payload.discrepancies) if (!CODES.has(d)) violations++;
    if (!['confirmed', 'exception'].includes(r.output_payload.integrity_status)) violations++;
  }
  return { name: 'P4_discrepancies_and_status_bounded_to_declared_enums', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const BOUNDARY_CASES = [
  [{ source_extract_hash: 'h1', report_hash: 'h1', source_row_count: 10, report_row_count: 10, source_control_total: 100, report_control_total: 100.5, tolerance: 0.5 }, 'delta exactly at tolerance (0.5) — must be within tolerance (<=)'],
  [{ source_extract_hash: 'h1', report_hash: 'h1', source_row_count: 10, report_row_count: 10, source_control_total: 100, report_control_total: 100.50000000001, tolerance: 0.5 }, 'delta one epsilon step outside tolerance — must be out of tolerance'],
  [{ source_extract_hash: 'h1', report_hash: 'h1', source_row_count: 10, report_row_count: 10, source_control_total: 100, report_control_total: 100, tolerance: 0 }, 'tolerance exactly zero with exact match — must be within tolerance'],
  [{ source_extract_hash: 'h1', report_hash: 'h1', source_row_count: 10, report_row_count: 10, source_control_total: 100, report_control_total: 100.0001, tolerance: 0 }, 'tolerance exactly zero with any delta — must be out of tolerance'],
  [{ source_extract_hash: 'h1', report_hash: 'h1', source_row_count: 10, report_row_count: 10, source_control_total: 100, report_control_total: -100.5, tolerance: -5 }, 'negative tolerance supplied — clamps to 0 via Math.max(0,...), must not allow a negative-tolerance false pass'],
  [{ source_extract_hash: '', report_hash: '', source_row_count: 0, report_row_count: 0, source_control_total: 0, report_control_total: 0, tolerance: 0 }, 'both hashes empty string — hash_match must be false (empty-string guard), not a vacuous true'],
  [{ source_extract_hash: 'h1', report_hash: 'h1', source_row_count: -0, report_row_count: 0, source_control_total: -0, report_control_total: 0, tolerance: 0 }, 'negative-zero row count and control total — must equal positive zero, no NaN, confirmed'],
  [{ source_extract_hash: 'h1', report_hash: 'H1', source_row_count: 10, report_row_count: 10, source_control_total: 100, report_control_total: 100, tolerance: 0 }, 'case-differing hash strings — hash comparison is exact string equality, must be HASH_MISMATCH'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { hash_match, total_within_tolerance, integrity_status } = r.output_payload;
    const plausible = typeof hash_match === 'boolean' && typeof total_within_tolerance === 'boolean' && ['confirmed', 'exception'].includes(integrity_status);
    rows.push({ label, input: pp, hash_match, total_within_tolerance, integrity_status, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_statusMatchesDiscrepancies());
results.properties.push(checkP2_hashMatchExact());
results.properties.push(checkP3_toleranceExact());
results.properties.push(checkP4_bounded());
results.boundary_forced = checkP5_forced();

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

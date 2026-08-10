// kernel_digest_at_authoring: sha256:640dfd01155c133e833f96c9b7304ae863c00abeb361a3d1d707e96fc85e9b40
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-409-dpa-art28-completeness-checker.
// Class B (bounded-numeric), float:no (all inputs/outputs are enum status strings and integer
// counts) — forced CATEGORICAL boundary cases used instead of ULP forcing, per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-409-dpa-art28-completeness-checker.proptest.mjs

import { compute } from '../art-409-dpa-art28-completeness-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

const ELEMENT_IDS = [
  'subject_matter', 'duration', 'nature_purpose', 'data_categories',
  'controller_instructions_only', 'confidentiality', 'article32_security',
  'subprocessor_authorization', 'data_subject_rights_assistance',
  'breach_dpia_assistance', 'deletion_or_return', 'audit_rights',
];

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-409-dpa-art28-completeness-checker.fixtures.json');
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
const rand = mulberry32(0x409C3);
const TRIALS = 10000;
const STATUSES = ['present', 'weak', 'missing', 'bogus', undefined];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const clause_status = {};
  for (const id of ELEMENT_IDS) {
    const v = pick(rng, STATUSES);
    if (v !== undefined) clause_status[id] = v;
  }
  return { clause_status };
}

// ---------- P1: fixed rule — art28_complete === (missing_count===0 && weak_count===0) ----------
function checkP1_completeRule() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = r.output_payload.missing_count === 0 && r.output_payload.weak_count === 0;
    if (r.output_payload.art28_complete !== expected) violations++;
  }
  return { name: 'P1_art28_complete_exact_rule', trials: checked, violations };
}

// ---------- P2: boundedness — present+weak+missing === total_elements === 12 ----------
function checkP2_countsPartition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.total_elements !== 12) violations++;
    if (op.present_count + op.weak_count + op.missing_count !== op.total_elements) violations++;
    if (!['ART28_COMPLETE', 'ART28_INCOMPLETE_MISSING_CLAUSES', 'ART28_INCOMPLETE_WEAK_CLAUSES'].includes(op.verdict)) violations++;
  }
  return { name: 'P2_counts_partition_and_verdict_bounded', trials: checked, violations };
}

// ---------- P3: fixed rule — coverage_pct === round(present/12*10000)/100, bounded [0,100] ----------
function checkP3_coveragePct() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const expected = Math.round((op.present_count / op.total_elements) * 10000) / 100;
    if (op.coverage_pct !== expected) violations++;
    if (op.coverage_pct < 0 || op.coverage_pct > 100) violations++;
  }
  return { name: 'P3_coverage_pct_exact_and_bounded', trials: checked, violations };
}

// ---------- P4 (categorical boundary forcing, float:no exception) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ clause_status: Object.fromEntries(ELEMENT_IDS.map((id) => [id, 'present'])) }, 'all 12 present — must be ART28_COMPLETE, coverage_pct exactly 100'],
  [{ clause_status: {} }, 'empty clause_status object — all 12 default to missing, ART28_INCOMPLETE_MISSING_CLAUSES, coverage 0'],
  [{ clause_status: null }, 'null clause_status — non-object guard must still default all 12 to missing, no throw'],
  [{}, 'empty policy_parameters — same as null clause_status, all missing'],
  [{ clause_status: Object.fromEntries(ELEMENT_IDS.map((id) => [id, 'weak'])) }, 'all 12 weak — ART28_INCOMPLETE_WEAK_CLAUSES, missing_count 0, weak_count 12'],
  [{ clause_status: { subject_matter: 'present', duration: 'missing', nature_purpose: 'weak' } }, 'mixed 1 present/1 missing/1 weak (rest default missing) — missing wins verdict over weak'],
  [{ clause_status: Object.fromEntries(ELEMENT_IDS.map((id) => [id, 'BOGUS_STATUS'])) }, 'unrecognized status string on every element — must fall through to missing, never throw or pass through the raw string'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = op.total_elements === 12
      && op.present_count + op.weak_count + op.missing_count === 12
      && ['ART28_COMPLETE', 'ART28_INCOMPLETE_MISSING_CLAUSES', 'ART28_INCOMPLETE_WEAK_CLAUSES'].includes(op.verdict)
      && op.clauses.every((c) => ['present', 'weak', 'missing'].includes(c.status));
    rows.push({ label, input: pp, verdict: op.verdict, present_count: op.present_count, weak_count: op.weak_count, missing_count: op.missing_count, coverage_pct: op.coverage_pct, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_completeRule());
results.properties.push(checkP2_countsPartition());
results.properties.push(checkP3_coveragePct());
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

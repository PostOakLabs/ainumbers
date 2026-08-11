// kernel_digest_at_authoring: sha256:4b87c5c2bfd4fe2fd1af9582a401b4cc75061a9f49df2e5204901721740ce94b
//
// FV-PROPFLOOR-SHARD-B26-1 — property-test floor for art-545-slate-readiness-diagnostic.
// Class B (bounded-categorical), FLOAT:NO per the WU row — a pure boolean checklist tally
// (dimensions_passed = 5 - gaps.length, grade lookup by index), no arithmetic beyond integer
// counting. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B3/B12
// harness. READ-ONLY w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-545-slate-readiness-diagnostic.proptest.mjs

import { compute } from '../art-545-slate-readiness-diagnostic.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-545-slate-readiness-diagnostic.fixtures.json');
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
const rand = mulberry32(0x545545);
const TRIALS = 8000;
const DIMS = ['reporting_agent_registered', 'same_day_capture_configured', 'field_spec_mapping_complete', 'unique_loan_identifier_scheme', 'recordkeeping_retention_configured'];
const GRADES = ['F', 'E', 'D', 'C', 'B', 'A'];

function mkPP(rng) {
  const pp = {};
  for (const d of DIMS) {
    const roll = rng();
    pp[d] = roll < 0.4 ? true : roll < 0.8 ? false : undefined;
  }
  return pp;
}

// ---------- P1: dimensions_passed = 5 - gaps.length, exact ----------
function checkP1_passedEqualsFiveMinusGaps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.dimensions_passed !== 5 - r.gaps.length) violations++;
    if (r.gaps.length < 0 || r.gaps.length > 5) violations++;
  }
  return { name: 'P1_dimensions_passed_equals_5_minus_gaps_length', trials: checked, violations };
}

// ---------- P2: grade is the exact lookup GRADES[dimensions_passed] ----------
function checkP2_gradeExactLookup() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.grade !== GRADES[r.dimensions_passed]) violations++;
  }
  return { name: 'P2_grade_exact_lookup_by_dimensions_passed', trials: checked, violations };
}

// ---------- P3: ready is the exact negation of "any gap present" ----------
function checkP3_readyExactNegationOfGaps() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.ready !== (r.gaps.length === 0)) violations++;
    if (r.ready !== (r.grade === 'A')) violations++;
  }
  return { name: 'P3_ready_exact_negation_of_any_gap', trials: checked, violations };
}

// ---------- P4: gaps contains exactly the dimension keys not strictly true, in declared order ----------
function checkP4_gapsExactSetInOrder() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const expected = DIMS.filter((d) => pp[d] !== true);
    if (JSON.stringify(r.gaps) !== JSON.stringify(expected)) violations++;
  }
  return { name: 'P4_gaps_exact_set_in_declared_order', trials: checked, violations };
}

// ---------- P5 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'entirely empty input — all 5 gaps present, grade F, ready false'],
  [Object.fromEntries(DIMS.map((d) => [d, true])), 'all 5 dimensions exactly true — grade A, ready true, zero gaps'],
  [Object.fromEntries(DIMS.map((d, i) => [d, i !== 0])), 'exactly 4 of 5 true (one gap) — grade B boundary, ready false'],
  [Object.fromEntries(DIMS.map((d, i) => [d, i === 0])), 'exactly 1 of 5 true (four gaps) — grade E boundary'],
  [{ reporting_agent_registered: 'true', same_day_capture_configured: 1, field_spec_mapping_complete: true, unique_loan_identifier_scheme: true, recordkeeping_retention_configured: true }, 'truthy non-boolean values ("true" string, 1 number) — must be treated as NOT strictly true (=== true gate), so these count as gaps'],
];

function checkP5_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = typeof r.ready === 'boolean' && GRADES.indexOf(r.grade) >= 0 && Array.isArray(r.gaps) && Number.isInteger(r.dimensions_passed);
    rows.push({ label, input: pp, ready: r.ready, grade: r.grade, dimensions_passed: r.dimensions_passed, gaps: r.gaps, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_passedEqualsFiveMinusGaps());
results.properties.push(checkP2_gradeExactLookup());
results.properties.push(checkP3_readyExactNegationOfGaps());
results.properties.push(checkP4_gapsExactSetInOrder());
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

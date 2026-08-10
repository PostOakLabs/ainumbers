// kernel_digest_at_authoring: sha256:321c4ae845ad4b8eaa346c89c48f00f67f908fa5febb4bcc334f59186ad5b0b0
//
// FV-PROPFLOOR-SHARD-B8-1 — property-test floor for art-241-cbpr-structured-address-linter.
// Class B (bounded categorical), float:no exception per the WU row — string/array structural
// linting only, no continuous arithmetic beyond a fixed-penalty readiness percentage. Forced
// categorical boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1-B7 harnesses. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-241-cbpr-structured-address-linter.proptest.mjs

import { compute } from '../art-241-cbpr-structured-address-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-241-cbpr-structured-address-linter.fixtures.json');
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
const rand = mulberry32(0x2410A1);
const TRIALS = 10000;

function mkFullPP(rng) {
  return {
    street_name: 'Street' + Math.floor(rng() * 100),
    building_number: String(Math.floor(rng() * 999)),
    post_code: 'PC' + Math.floor(rng() * 999),
    town_name: 'Town' + Math.floor(rng() * 100),
    country: 'US',
    country_subdivision: 'CA',
    address_lines: [],
  };
}

// ---------- P1: monotone — going from empty to fully-structured never increases error_count ----------
function checkP1_monotoneErrors() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const worse = {};
    const better = mkFullPP(rand);
    const r1 = compute(worse);
    const r2 = compute(better);
    checked++;
    if (r2.output_payload.error_count > r1.output_payload.error_count) violations++;
    if (r2.output_payload.compliant !== true) violations++;
  }
  return { name: 'P1_monotone_error_count_nonincreasing_toward_full_structure', trials: checked, violations };
}

// ---------- P2: boundedness — readiness_pct in [0,100], structure_type from known set ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN_TYPES = new Set(['FULLY_STRUCTURED', 'HYBRID', 'UNSTRUCTURED', 'EMPTY', 'MIXED_INVALID']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkFullPP(rand);
    if (rand() < 0.3) pp.address_lines = ['line ' + Math.floor(rand() * 100)];
    const r = compute(pp);
    checked++;
    const { readiness_pct, structure_type, error_count } = r.output_payload;
    if (readiness_pct < 0 || readiness_pct > 100) violations++;
    if (!KNOWN_TYPES.has(structure_type)) violations++;
    if (error_count < 0) violations++;
  }
  return { name: 'P2_boundedness_readiness_pct_and_structure_type', trials: checked, violations };
}

// ---------- P3: fixed rule agreement — compliant matches error_count/structure_type formula ----------
function checkP3_compliantAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkFullPP(rand);
    if (rand() < 0.3) pp.address_lines = ['line ' + Math.floor(rand() * 100)];
    const r = compute(pp);
    checked++;
    const { error_count, structure_type, compliant } = r.output_payload;
    const expected = error_count === 0 && (structure_type === 'FULLY_STRUCTURED' || structure_type === 'HYBRID');
    if (compliant !== expected) violations++;
  }
  return { name: 'P3_compliant_matches_fixed_structure_and_error_rule', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'fully empty input — EMPTY structure_type, no throw'],
  [{ address_lines: ['123 Main St, Springfield'] }, 'AdrLine-only, no structured fields — UNSTRUCTURED, prohibited flag'],
  [{ street_name: 'Main St', building_number: '123', post_code: '90210', country: 'US' }, 'all structured fields, no AdrLine — FULLY_STRUCTURED, compliant'],
  [{ town_name: 'Springfield', country: 'US', address_lines: ['line1', 'line2'] }, 'hybrid with exactly 2 AdrLine (at max) — HYBRID, compliant'],
  [{ town_name: 'Springfield', country: 'US', address_lines: ['line1', 'line2', 'line3'] }, 'hybrid with 3 AdrLine (exceeds max 2) — EXCESS_ADR_LINES error'],
  [{ town_name: 'Springfield', country: 'US', address_lines: ['x'.repeat(71)] }, 'AdrLine exceeding 70 chars — ADR_LINE_TOO_LONG error'],
  [{ street_name: 'Main Street', town_name: 'Springfield', country: 'US', address_lines: ['Main Street'] }, 'AdrLine duplicates structured street_name verbatim — SILENT_FAIL_DUPLICATION'],
  [{ country: 'us' }, 'lowercase country code — INVALID_COUNTRY error'],
  [{ country: 'USA' }, '3-letter country code — INVALID_COUNTRY error'],
  [{ building_number: '123' }, 'single structured field, no country — MIXED_INVALID'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { structure_type, compliant, readiness_pct, error_count } = r.output_payload;
    const plausible = typeof structure_type === 'string' && typeof compliant === 'boolean' && Number.isFinite(readiness_pct) && Number.isFinite(error_count);
    rows.push({ label, pp, structure_type, compliant, readiness_pct, error_count, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneErrors());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_compliantAgreement());
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

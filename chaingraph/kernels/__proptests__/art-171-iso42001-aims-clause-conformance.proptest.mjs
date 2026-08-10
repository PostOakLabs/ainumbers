// kernel_digest_at_authoring: sha256:6cf5102a16176e735d0a61a46e5bd06191bbc7ef5d12c2ce96cea472cd55e14f
//
// FV-PROPFLOOR-SHARD-B4-1 — property-test floor for art-171-iso42001-aims-clause-conformance.
// Class B (bounded), float:no exception per the WU row — inputs are restricted to the
// three-value enum {true, 'partial', other→absent}, so the division/rounding arithmetic
// operates over a small finite domain, not attacker-controlled raw doubles. Forced
// categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-171-iso42001-aims-clause-conformance.proptest.mjs

import { compute } from '../art-171-iso42001-aims-clause-conformance.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-171-iso42001-aims-clause-conformance.fixtures.json');
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
const rand = mulberry32(0x17101);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CLAUSE_FIELDS = ['clause_4_context', 'clause_5_leadership', 'clause_6_planning', 'clause_7_support', 'clause_8_operation', 'clause_9_evaluation', 'clause_10_improvement'];
const CONTROL_FIELDS = ['annex_a_ai_policy', 'annex_a_roles', 'annex_a_impact_assessment', 'annex_a_data_governance', 'annex_a_system_lifecycle', 'annex_a_third_party'];
const ALL_FIELDS = [...CLAUSE_FIELDS, ...CONTROL_FIELDS];
const ENUM_VALUES = [true, 'partial', false, undefined];
const TRIALS = 10000;

function mkPP(rng) {
  const aims = {};
  for (const f of ALL_FIELDS) aims[f] = pick(rng, ENUM_VALUES);
  return { aims };
}

// ---------- P1: boundedness — clause_score/control_score/overall_maturity all in [0,100] ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { clause_score, control_score, overall_maturity } = r.output_payload;
    if (clause_score < 0 || clause_score > 100) violations++;
    if (control_score < 0 || control_score > 100) violations++;
    if (overall_maturity < 0 || overall_maturity > 100) violations++;
  }
  return { name: 'P1_boundedness_scores_in_0_100', trials: checked, violations };
}

// ---------- P2: monotone — flipping one field from absent to present never decreases clause_score/control_score ----------
function checkP2_monotoneFieldUpgrade() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const f = pick(rand, ALL_FIELDS);
    checked++;
    const worse = { aims: { ...pp.aims, [f]: false } };
    const better = { aims: { ...pp.aims, [f]: true } };
    const rW = compute(worse);
    const rB = compute(better);
    if (rB.output_payload.overall_maturity < rW.output_payload.overall_maturity) violations++;
  }
  return { name: 'P2_monotone_overall_maturity_nondecreasing_on_field_upgrade', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — maturity_band exactly matches the documented overall_maturity band cuts ----------
function checkP3_bandAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const m = r.output_payload.overall_maturity;
    let expected;
    if (m < 25) expected = 'Initial';
    else if (m < 50) expected = 'Developing';
    else if (m < 75) expected = 'Defined';
    else if (m < 90) expected = 'Managed';
    else expected = 'Optimizing';
    if (r.output_payload.maturity_band !== expected) violations++;
  }
  return { name: 'P3_maturity_band_matches_fixed_score_cuts', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable; enum-domain-only) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — overall_maturity exactly 0, band Initial, 13 gaps'],
  [{ aims: Object.fromEntries(ALL_FIELDS.map((f) => [f, true])) }, 'all 13 fields true — overall_maturity exactly 100, band Optimizing'],
  [{ aims: { clause_4_context: 'partial' } }, "single clause 'partial' out of 13 fields — must weight 0.5, not throw"],
  [{ aims: { clause_4_context: 'unexpected_string' } }, "unrecognized string value (not 'partial') — must weight as absent (0.0)"],
  [{ aims: { clause_4_context: 1 } }, 'numeric 1 instead of boolean true — must weight as absent (0.0), strict === true check'],
  [{ aims: null }, 'aims field explicitly null — must fall back to empty object, no throw'],
  [{ aims: Object.fromEntries(CLAUSE_FIELDS.map((f) => [f, true])) }, 'exactly clause fields present, all controls absent — overall_maturity must land exactly at the Managed/Defined boundary region, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { overall_maturity, maturity_band } = r.output_payload;
    const plausible = Number.isFinite(overall_maturity) && overall_maturity >= 0 && overall_maturity <= 100 && ['Initial', 'Developing', 'Defined', 'Managed', 'Optimizing'].includes(maturity_band);
    rows.push({ label, pp, overall_maturity, maturity_band, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_monotoneFieldUpgrade());
results.properties.push(checkP3_bandAgreement());
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

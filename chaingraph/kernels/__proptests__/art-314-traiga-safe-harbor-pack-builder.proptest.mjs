// kernel_digest_at_authoring: sha256:cda8ec3e208db10583b64a541b161952225891579c887aa1c900f1ab1e317f20
//
// FV-PROPFLOOR-SHARD-B12-1 — property-test floor for art-314-traiga-safe-harbor-pack-builder.
// Class B (bounded-numeric/categorical), FLOAT:NO exception per the WU row — coverage_band is a
// discrete enum, overall_coverage/prohibited_use_detected pass through unmodified with no
// arithmetic. Forced CATEGORICAL boundary cases used in place of ULP forcing. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B3 harness.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-314-traiga-safe-harbor-pack-builder.proptest.mjs

import { compute } from '../art-314-traiga-safe-harbor-pack-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-314-traiga-safe-harbor-pack-builder.fixtures.json');
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
const rand = mulberry32(0x3140A1);
const TRIALS = 8000;
const BANDS = ['Minimal', 'Partial', 'Substantial', 'Comprehensive', 'Unrecognized'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const hasRmf = rng() < 0.85;
  const hasExposure = rng() < 0.85;
  const pp = {};
  if (hasRmf) {
    pp.rmf_mapping = { coverage_band: pick(rng, BANDS), overall_coverage: Math.floor(rng() * 101) };
  }
  if (hasExposure) {
    pp.exposure_result = { prohibited_use_detected: rng() < 0.5 };
  }
  return pp;
}

// ---------- P1: insufficient_evidence is the exact negation of "both objects present" ----------
function checkP1_insufficientEvidenceExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = !(pp.rmf_mapping && typeof pp.rmf_mapping === 'object') || !(pp.exposure_result && typeof pp.exposure_result === 'object');
    if (r.output_payload.insufficient_evidence !== expected) violations++;
  }
  return { name: 'P1_insufficient_evidence_exact_negation_of_both_objects_present', trials: checked, violations };
}

// ---------- P2: meets_substantial_compliance_bar is bounded to the qualifying-bands set ----------
function checkP2_substantialBarBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { meets_substantial_compliance_bar, insufficient_evidence, coverage_band } = r.output_payload;
    if (meets_substantial_compliance_bar && insufficient_evidence) violations++;
    if (meets_substantial_compliance_bar && !['Substantial', 'Comprehensive'].includes(coverage_band)) violations++;
    if (!insufficient_evidence && ['Substantial', 'Comprehensive'].includes(coverage_band) && !meets_substantial_compliance_bar) violations++;
  }
  return { name: 'P2_meets_substantial_bar_bounded_to_qualifying_bands', trials: checked, violations };
}

// ---------- P3: eligible flag is the exact AND of bar-met and prohibited-use-false ----------
function checkP3_eligibleIsExactAnd() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { eligible_for_affirmative_defense_evidence, meets_substantial_compliance_bar, prohibited_use_detected, insufficient_evidence } = r.output_payload;
    const expected = !insufficient_evidence && meets_substantial_compliance_bar && prohibited_use_detected === false;
    if (eligible_for_affirmative_defense_evidence !== expected) violations++;
  }
  return { name: 'P3_eligible_equals_bar_met_and_not_prohibited', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'both rmf_mapping and exposure_result entirely absent — insufficient_evidence must be true'],
  [{ rmf_mapping: { coverage_band: 'Substantial', overall_coverage: 80 } }, 'exposure_result missing entirely — insufficient_evidence must be true despite qualifying band'],
  [{ exposure_result: { prohibited_use_detected: false } }, 'rmf_mapping missing entirely — insufficient_evidence must be true despite non-prohibited exposure'],
  [{ rmf_mapping: { coverage_band: 'Substantial' }, exposure_result: { prohibited_use_detected: false } }, 'coverage_band exactly "Substantial" (lower qualifying boundary) — must meet bar'],
  [{ rmf_mapping: { coverage_band: 'Comprehensive' }, exposure_result: { prohibited_use_detected: false } }, 'coverage_band exactly "Comprehensive" (upper qualifying boundary) — must meet bar'],
  [{ rmf_mapping: { coverage_band: 'Partial' }, exposure_result: { prohibited_use_detected: false } }, 'coverage_band exactly "Partial" (just below qualifying set) — must NOT meet bar'],
  [{ rmf_mapping: { coverage_band: 'Substantial' }, exposure_result: { prohibited_use_detected: true } }, 'qualifying band but prohibited_use_detected exactly true — must NOT be eligible'],
  [{ rmf_mapping: { coverage_band: 'Unrecognized-Band' }, exposure_result: { prohibited_use_detected: false } }, 'unrecognized coverage_band string — must NOT meet bar (fail-closed on unknown enum)'],
  [{ rmf_mapping: 'not-an-object', exposure_result: { prohibited_use_detected: false } }, 'rmf_mapping is a non-object type — must be treated as absent (insufficient_evidence true)'],
  [{ rmf_mapping: { coverage_band: 'Substantial' }, exposure_result: {} }, 'exposure_result present but prohibited_use_detected key missing — undefined===true is false, so this resolves to eligible (documents the strict-equality-to-true gate, not a null-passthrough)'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { insufficient_evidence, meets_substantial_compliance_bar, eligible_for_affirmative_defense_evidence, coverage_band, prohibited_use_detected } = r.output_payload;
    const plausible = typeof insufficient_evidence === 'boolean' && typeof meets_substantial_compliance_bar === 'boolean' && typeof eligible_for_affirmative_defense_evidence === 'boolean';
    rows.push({ label, input: pp, insufficient_evidence, meets_substantial_compliance_bar, eligible_for_affirmative_defense_evidence, coverage_band, prohibited_use_detected, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_insufficientEvidenceExact());
results.properties.push(checkP2_substantialBarBounded());
results.properties.push(checkP3_eligibleIsExactAnd());
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

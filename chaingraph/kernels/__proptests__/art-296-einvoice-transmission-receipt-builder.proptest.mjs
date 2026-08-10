// kernel_digest_at_authoring: sha256:efd9144454c833bea1da03c8c2003da04d8d3b21f33bd1e5e963a512bf21278c
//
// FV-PROPFLOOR-SHARD-B28-1 — property-test floor for art-296-einvoice-transmission-receipt-builder.
// Class B (bounded-numeric per the WU row), NOT float-sensitive — pure boolean-gate composition,
// no arithmetic at all. Forced CATEGORICAL boundary cases (each gate individually true/false) used
// instead of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-296-einvoice-transmission-receipt-builder.proptest.mjs

import { compute } from '../art-296-einvoice-transmission-receipt-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-296-einvoice-transmission-receipt-builder.fixtures.json');
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
const rand = mulberry32(0x296C3);
const TRIALS = 8000;

function mkPP(rng) {
  const hasDoc = rng() < 0.85;
  const hasHash = rng() < 0.85;
  const hasFormat = rng() < 0.85;
  const document = hasDoc ? { document_sha256: hasHash ? 'a'.repeat(64) : null, embedded_xml_sha256: null, format: hasFormat ? 'xrechnung' : null } : null;
  const fv = rng() < 0.85 ? { structural_completeness: rng() < 0.7 } : null;
  const vv = rng() < 0.85 ? { consistent: rng() < 0.7 } : null;
  return { document, format_validation: fv, vat_verification: vv, routed_mandate: rng() < 0.5 ? { regime_country: 'FR' } : null };
}

// ---------- P1: boundedness — validated is always boolean, claim_strength is one of the two declared enum values ----------
function checkP1_claimStrengthBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { validated, claim_strength } = r.output_payload;
    if (typeof validated !== 'boolean') violations++;
    if (claim_strength !== 'format_and_arithmetic_verified' && claim_strength !== 'unverified') violations++;
  }
  return { name: 'P1_claim_strength_bounded_to_two_declared_states', trials: checked, violations };
}

// ---------- P2: fixed rule — validated is exactly the conjunction of the three gates ----------
function checkP2_validatedExactConjunction() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const document = pp.document || {};
    const parsed_ok = !!document.document_sha256 && !!document.format;
    const format_gate_passed = !!(pp.format_validation && pp.format_validation.structural_completeness === true);
    const vat_gate_passed = !!(pp.vat_verification && pp.vat_verification.consistent === true);
    const expected = parsed_ok && format_gate_passed && vat_gate_passed;
    if (r.output_payload.validated !== expected) violations++;
    if (r.output_payload.claim_strength !== (expected ? 'format_and_arithmetic_verified' : 'unverified')) violations++;
  }
  return { name: 'P2_validated_exact_conjunction_of_three_gates', trials: checked, violations };
}

// ---------- P3: monotonicity — flipping any true gate to false never flips validated from false to true ----------
function checkP3_monotonicInGates() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const rBase = compute(pp);
    const weakened = { ...pp, vat_verification: null };
    const rWeak = compute(weakened);
    checked++;
    if (rBase.output_payload.validated === false && rWeak.output_payload.validated === true) violations++;
  }
  return { name: 'P3_removing_a_gate_never_flips_validated_false_to_true', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (every gate individually failing) ----------
const BOUNDARY_CASES = [
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: true }, routed_mandate: null }, 'all three gates pass — validated must be true, claim_strength format_and_arithmetic_verified'],
  [{ document: null, format_validation: { structural_completeness: true }, vat_verification: { consistent: true }, routed_mandate: null }, 'document absent — parsed_ok gate fails, validated must be false'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: false }, vat_verification: { consistent: true }, routed_mandate: null }, 'format gate explicitly false — validated must be false'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: false }, routed_mandate: null }, 'vat gate explicitly false — validated must be false'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: null, vat_verification: { consistent: true }, routed_mandate: null }, 'format_validation object entirely absent (not merely false) — gate must fail closed'],
  [{ document: { document_sha256: null, format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: true }, routed_mandate: null }, 'document_sha256 null within a present document object — parsed_ok must be false'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of BOUNDARY_CASES) {
    const r = compute(pp);
    const { validated, claim_strength } = r.output_payload;
    const plausible = typeof validated === 'boolean' && (claim_strength === 'format_and_arithmetic_verified' || claim_strength === 'unverified');
    rows.push({ label, input: pp, validated, claim_strength, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_claimStrengthBounded());
results.properties.push(checkP2_validatedExactConjunction());
results.properties.push(checkP3_monotonicInGates());
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

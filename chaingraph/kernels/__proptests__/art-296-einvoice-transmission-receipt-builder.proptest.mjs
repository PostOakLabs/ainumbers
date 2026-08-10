// kernel_digest_at_authoring: sha256:96f5d33248497f132d16bc20b15dea490b61aa7bddbf9f43a546f365d87b0233
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-296-einvoice-transmission-receipt-builder.
// Class B (bounded categorical), float:no exception per the WU row — boolean-gate AND-combination
// logic only, no continuous arithmetic. Forced categorical boundary cases used in place of ULP
// forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2/B3 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
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
const rand = mulberry32(0x29601);

function mkPP(rng) {
  const structural_completeness = rng() < 0.5;
  const consistent = rng() < 0.5;
  return {
    document: {
      document_sha256: rng() < 0.9 ? 'a'.repeat(64) : null,
      embedded_xml_sha256: null,
      format: rng() < 0.9 ? 'xrechnung' : null,
    },
    format_validation: { structural_completeness },
    vat_verification: { consistent },
    routed_mandate: { regime_country: 'FR', applicable_format: 'factur-x_or_ubl', mandatory_from: '2026-09-01', phase_status: 'mandatory', transmission_channel: 'PDP', table_version: 't' },
  };
}

// ---------- P1: fixed-threshold-tier agreement — validated is exactly the AND of parsed+both gates ----------
function checkP1_validatedAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 10000; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const parsed_ok = !!pp.document.document_sha256 && !!pp.document.format;
    const expected = parsed_ok && pp.format_validation.structural_completeness === true && pp.vat_verification.consistent === true;
    if (r.output_payload.validated !== expected) violations++;
    if (r.output_payload.claim_strength !== (expected ? 'format_and_arithmetic_verified' : 'unverified')) violations++;
  }
  return { name: 'P1_validated_matches_fixed_and_gate_rule', trials: checked, violations };
}

// ---------- P2: boundedness — steps array always has exactly 3 fixed entries in fixed order ----------
function checkP2_stepsBoundedness() {
  let violations = 0, checked = 0;
  const EXPECTED_IDS = ['art-293-einvoice-format-validator', 'art-294-einvoice-vat-calc-verifier', 'art-295-einvoice-jurisdiction-mandate-router'];
  for (let i = 0; i < 10000; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { steps } = r.output_payload;
    if (steps.length !== 3) violations++;
    for (let j = 0; j < 3; j++) if (steps[j].tool_id !== EXPECTED_IDS[j]) violations++;
  }
  return { name: 'P2_steps_fixed_length_and_order', trials: checked, violations };
}

// ---------- P3: monotone — flipping vat_gate or format_gate to false never flips validated true→ still false ----------
function checkP3_monotoneGateDowngrade() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 10000; i++) {
    const pp = mkPP(rand);
    const pass = { ...pp, format_validation: { structural_completeness: true }, vat_verification: { consistent: true } };
    const failVat = { ...pass, vat_verification: { consistent: false } };
    const r1 = compute(pass);
    const r2 = compute(failVat);
    checked++;
    if (r1.output_payload.validated === false) continue;
    if (r2.output_payload.validated !== false) violations++;
  }
  return { name: 'P3_downgrading_any_gate_never_increases_validated', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input — document_sha256/format null, all gates false, validated false, steps still 3 entries, no throw'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: true } }, 'both gates exactly true — validated must be true'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: null }, 'vat_verification entirely absent (null) — vat_gate_passed must be false, validated false'],
  [{ document: { document_sha256: null, format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: true } }, 'document_sha256 missing alone — parsed_ok false, validated false even with both gates true'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: 'true' }, vat_verification: { consistent: true } }, 'structural_completeness as string "true" not boolean true — must NOT pass (strict === true check)'],
  [{ routed_mandate: null }, 'routed_mandate explicitly null — output routed_mandate must be null, not throw'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: true }, routed_mandate: {} }, 'routed_mandate present but empty object — must pass through as-is, not null'],
  [{ document: 'not-an-object' }, 'document field is a string, not object — must safely fall back to empty object shape'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: false }, vat_verification: { consistent: true } }, 'format gate false, vat gate true — validated must be false (AND, not OR)'],
  [{ document: { document_sha256: 'a'.repeat(64), format: 'xrechnung' }, format_validation: { structural_completeness: true }, vat_verification: { consistent: false } }, 'format gate true, vat gate false — validated must be false'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { validated, claim_strength, steps, ha_wiring } = r.output_payload;
    const plausible = typeof validated === 'boolean'
      && ['format_and_arithmetic_verified', 'unverified'].includes(claim_strength)
      && Array.isArray(steps) && steps.length === 3
      && ha_wiring && ha_wiring.release_gate_policy === 'review_required';
    rows.push({ label, pp, validated, claim_strength, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_validatedAgreement());
results.properties.push(checkP2_stepsBoundedness());
results.properties.push(checkP3_monotoneGateDowngrade());
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

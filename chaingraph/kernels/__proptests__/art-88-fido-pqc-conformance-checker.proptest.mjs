// kernel_digest_at_authoring: sha256:92b325e20fa5a4e60b6cc1b0080285af19bf639951c96ec6a0b76d69a57b823b
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-88-fido-pqc-conformance-checker.
// Class B (bounded-numeric/categorical), FLOAT:NO per the WU row — every computation is integer
// COSE-algorithm-ID lookup/membership testing and string comparison (including a lexicographic
// ">=" comparison of CTAP version strings), no float arithmetic anywhere. Forced CATEGORICAL
// boundary cases used in place of ULP forcing. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B12 harness. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-88-fido-pqc-conformance-checker.proptest.mjs

import { compute } from '../art-88-fido-pqc-conformance-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-88-fido-pqc-conformance-checker.fixtures.json');
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
const rand = mulberry32(0x88F6A7);
const TRIALS = 8000;
const COSE_PQC = [-48, -49, -50];
const COSE_LEGACY = [-7, -35, -36, -257, -258, -259];
const CTAP_VERSIONS = ['1.0', '2.0', '2.1', '2.3', '2.4'];
const TARGETS = ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  const algs = [];
  if (rng() < 0.5) algs.push(pick(rng, COSE_PQC));
  if (rng() < 0.5) algs.push(pick(rng, COSE_LEGACY));
  return {
    authenticator: {
      cose_algorithms: algs,
      attestation_format: rng() < 0.9 ? 'packed' : 'none',
      ctap_version: pick(rng, CTAP_VERSIONS),
    },
    target_pqc: pick(rng, TARGETS),
  };
}

const COSE_PQC_IDS = { 'ML-DSA-44': -48, 'ML-DSA-65': -49, 'ML-DSA-87': -50 };

// ---------- P1: conformant is the exact AND of target_supported and ctap_pqc_ready --------------------
function checkP1_conformantExactAnd() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const targetId = COSE_PQC_IDS[pp.target_pqc] ?? null;
    const targetSupported = targetId !== null && pp.authenticator.cose_algorithms.includes(targetId);
    const ctapReady = pp.authenticator.ctap_version >= '2.3';
    const expected = targetSupported && ctapReady;
    if (r.output_payload.conformant !== expected) violations++;
  }
  return { name: 'P1_conformant_exact_and_of_target_supported_and_ctap_ready', trials: checked, violations };
}

// ---------- P2: hybrid_status is exactly the 3-way partition (pqc+legacy / pqc-only / legacy-only) ----
function checkP2_hybridStatusExactPartition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { supported_pqc_cose_ids, hybrid_status } = r.output_payload;
    const legacyPresent = pp.authenticator.cose_algorithms.some((id) => COSE_LEGACY.includes(id));
    const expected = supported_pqc_cose_ids.length > 0 && legacyPresent ? 'hybrid'
      : supported_pqc_cose_ids.length > 0 ? 'pqc_only' : 'legacy_only';
    if (hybrid_status !== expected) violations++;
    if (!['hybrid', 'pqc_only', 'legacy_only'].includes(hybrid_status)) violations++;
  }
  return { name: 'P2_hybrid_status_exact_3way_partition', trials: checked, violations };
}

// ---------- P3: NO_PQC_COSE_SUPPORT flag is the exact negation of supported_pqc_cose_ids being non-empty ---
function checkP3_noPqcFlagExactNegation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { supported_pqc_cose_ids } = r.output_payload;
    const hasFlag = r.compliance_flags.includes('NO_PQC_COSE_SUPPORT');
    if ((supported_pqc_cose_ids.length === 0) !== hasFlag) violations++;
    const preFlag = r.compliance_flags.includes('PRE_CTAP23');
    if ((pp.authenticator.ctap_version < '2.3') !== preFlag) violations++;
  }
  return { name: 'P3_no_pqc_and_pre_ctap23_flags_exact_negation_of_condition', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'policy_parameters entirely empty — must use documented defaults (empty cose_algorithms, packed, ctap 2.0, target ML-DSA-65), conformant must be false'],
  [{ authenticator: { cose_algorithms: [-49], ctap_version: '2.3' }, target_pqc: 'ML-DSA-65' }, 'ctap_version exactly "2.3" (the CTAP_23_REQUIRED boundary, comparison uses string >=) — ctap_pqc_ready must be true, target supported, conformant true'],
  [{ authenticator: { cose_algorithms: [-49], ctap_version: '2.2' }, target_pqc: 'ML-DSA-65' }, 'ctap_version "2.2" (one below the 2.3 boundary, lexicographic string comparison) — ctap_pqc_ready must be false, conformant false'],
  [{ authenticator: { cose_algorithms: [-49], ctap_version: '10.0' }, target_pqc: 'ML-DSA-65' }, 'ctap_version "10.0" — a KNOWN lexicographic-string-comparison trap ("10.0" < "2.3" as strings despite 10 > 2 numerically) — documents the kernel treats CTAP versions as strings, not semver-parsed, so this must resolve ctap_pqc_ready to FALSE'],
  [{ authenticator: { cose_algorithms: [], attestation_format: 'none', ctap_version: '2.3' }, target_pqc: 'ML-DSA-65' }, 'attestation_format exactly "none" — must add the attestation-chain gap message regardless of PQC support state'],
  [{ authenticator: { cose_algorithms: [-49, -7], ctap_version: '2.3' }, target_pqc: 'ML-DSA-65' }, 'both a PQC and a legacy COSE ID present — hybrid_status must be exactly "hybrid"'],
  [{ authenticator: { cose_algorithms: [-49], ctap_version: '2.3' }, target_pqc: 'ML-DSA-65' }, 'only the PQC COSE ID present — hybrid_status must be exactly "pqc_only"'],
  [{ authenticator: { cose_algorithms: [-7], ctap_version: '2.3' }, target_pqc: 'ML-DSA-65' }, 'only a legacy COSE ID present — hybrid_status must be exactly "legacy_only"'],
  [{ authenticator: { cose_algorithms: [-49], ctap_version: '2.3' }, target_pqc: 'unrecognized-target' }, 'target_pqc not in the COSE_PQC_IDS registry — target_cose_id must be exactly null, target never supported regardless of cose_algorithms, gaps array must name the null ID'],
  [{ authenticator: { cose_algorithms: [-48, -49, -50], ctap_version: '2.3' }, target_pqc: 'ML-DSA-87' }, 'all three PQC COSE IDs present, target is ML-DSA-87 (ID -50) — supported_pqc_cose_ids must contain exactly the three IDs, conformant true'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { conformant, hybrid_status, ctap_pqc_ready, target_cose_id } = r.output_payload;
    const plausible = typeof conformant === 'boolean' && ['hybrid', 'pqc_only', 'legacy_only'].includes(hybrid_status)
      && typeof ctap_pqc_ready === 'boolean' && (target_cose_id === null || Number.isInteger(target_cose_id));
    rows.push({ label, input: pp, conformant, hybrid_status, ctap_pqc_ready, gaps: r.output_payload.gaps, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_conformantExactAnd());
results.properties.push(checkP2_hybridStatusExactPartition());
results.properties.push(checkP3_noPqcFlagExactNegation());
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

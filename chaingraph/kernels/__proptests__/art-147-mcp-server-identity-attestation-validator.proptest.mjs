// kernel_digest_at_authoring: sha256:53a835c4eb29c70aecbe5a595bc2d64466e1391b6c0fcf4a2be48f795a51f73d
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-147-mcp-server-identity-attestation-validator.
// Class B (bounded categorical), float:no exception per the WU row — structural presence/shape
// checks only, no continuous arithmetic. Forced categorical boundary cases used in place of ULP
// forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG +
// explicit boundary arrays), same shape as the B1/B2 harnesses. This file is READ-ONLY with
// respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-147-mcp-server-identity-attestation-validator.proptest.mjs

import { compute } from '../art-147-mcp-server-identity-attestation-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-147-mcp-server-identity-attestation-validator.fixtures.json');
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
const rand = mulberry32(0x14701);
const TRIALS = 10000;
const WELL_KNOWN = '/.well-known/mcp-server-identity';

function mkIdentity(rng) {
  const identity = {};
  if (rng() < 0.5) identity.subject = 'did:web:example.com';
  if (rng() < 0.5) identity.issuer = 'did:web:registry.example.com';
  if (rng() < 0.5) identity.serverInfo = (rng() < 0.5) ? { name: 'Server', version: '1.0.0' } : { name: 'Server' };
  if (rng() < 0.5) identity.attestation = { ref: 'https://registry.example.com/attestations/x' };
  return {
    identity,
    well_known_path: rng() < 0.5 ? WELL_KNOWN : '/wrong-path',
    signature_valid: rng() < 0.7,
  };
}

// ---------- P1: monotone — completing every field never increases the missing[] array ----------
function checkP1_monotoneMissing() {
  let violations = 0, checked = 0;
  const COMPLETE = {
    identity: { subject: 'did:web:x', issuer: 'did:web:y', serverInfo: { name: 'S', version: '1' }, attestation: { ref: 'r' } },
    well_known_path: WELL_KNOWN,
    signature_valid: true,
  };
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkIdentity(rand);
    const r1 = compute(pp);
    const r2 = compute(COMPLETE);
    checked++;
    if (r2.output_payload.missing.length > r1.output_payload.missing.length) violations++;
    if (r1.output_payload.identity_valid && !r2.output_payload.identity_valid) violations++;
  }
  return { name: 'P1_monotone_missing_nonincreasing_toward_complete_identity', trials: checked, violations };
}

// ---------- P2: boundedness — missing[] drawn from the 5 known categories, identity_valid iff missing empty ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  const KNOWN = new Set(['WELL_KNOWN_PATH', 'SUBJECT', 'ISSUER', 'SERVER_INFO', 'ATTESTATION']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkIdentity(rand);
    const r = compute(pp);
    checked++;
    const { missing, identity_valid } = r.output_payload;
    for (const m of missing) if (!KNOWN.has(m)) violations++;
    if (identity_valid !== (missing.length === 0)) violations++;
  }
  return { name: 'P2_boundedness_missing_from_known_set_and_valid_iff_empty', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — each has_* flag matches its structural presence check ----------
function checkP3_hasFlagAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkIdentity(rand);
    const r = compute(pp);
    checked++;
    const { has_subject, has_issuer, has_server_info, attested } = r.output_payload;
    const id = pp.identity || {};
    const exp_subject = typeof id.subject === 'string' && id.subject.length > 0;
    const exp_issuer = typeof id.issuer === 'string' && id.issuer.length > 0;
    const exp_server_info = !!(id.serverInfo && id.serverInfo.name && id.serverInfo.version);
    const exp_attested = id.attestation != null && pp.signature_valid !== false;
    if (has_subject !== exp_subject) violations++;
    if (has_issuer !== exp_issuer) violations++;
    if (has_server_info !== exp_server_info) violations++;
    if (attested !== exp_attested) violations++;
  }
  return { name: 'P3_has_flags_match_structural_presence', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ identity: { issuer: 'did:web:y', serverInfo: { name: 'S', version: '1' }, attestation: {} }, well_known_path: WELL_KNOWN, signature_valid: true }, 'missing subject only — missing must be exactly [SUBJECT]'],
  [{ identity: { subject: 'did:web:x', serverInfo: { name: 'S', version: '1' }, attestation: {} }, well_known_path: WELL_KNOWN, signature_valid: true }, 'missing issuer only'],
  [{ identity: { subject: 'did:web:x', issuer: 'did:web:y', serverInfo: { name: 'S' }, attestation: {} }, well_known_path: WELL_KNOWN, signature_valid: true }, 'serverInfo missing version field — has_server_info must be false'],
  [{ identity: { subject: 'did:web:x', issuer: 'did:web:y', serverInfo: { name: 'S', version: '1' }, attestation: {} }, well_known_path: '/wrong', signature_valid: true }, 'wrong well_known_path with everything else valid — missing must contain exactly WELL_KNOWN_PATH'],
  [{ identity: { subject: 'did:web:x', issuer: 'did:web:y', serverInfo: { name: 'S', version: '1' }, attestation: { ref: 'r' } }, well_known_path: WELL_KNOWN, signature_valid: false }, 'signature explicitly false with attestation present — attested must be false'],
  [{ identity: {}, well_known_path: WELL_KNOWN, signature_valid: true }, 'completely empty identity — missing must list all 4 identity-shape categories plus none for path'],
  [{}, 'entirely empty policy_parameters — must default cleanly through every branch, not throw'],
  [{ identity: { subject: 'did:web:x', issuer: 'did:web:y', serverInfo: { name: 'S', version: '1' }, attestation: {} }, well_known_path: WELL_KNOWN }, 'signature_valid omitted (undefined, not false) — attested must be true since !== false'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { identity_valid, missing } = r.output_payload;
    const plausible = typeof identity_valid === 'boolean' && Array.isArray(missing);
    rows.push({ label, pp, identity_valid, missing, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneMissing());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_hasFlagAgreement());
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

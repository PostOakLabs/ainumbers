// kernel_digest_at_authoring: sha256:1bba28fe16295e569ea0581670c5d95070c8d2057df9d9b6f24da30624c4c6f6
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-287-revocation-status-verifier.
// Class B (bounded-numeric), FLOAT:NO — statusListIndex is an integer bit-address into a
// bounded byte array; base64url decode and bit extraction are pure integer/bitwise ops,
// no doubles enter compute() arithmetic anywhere. Forced CATEGORICAL boundary cases used
// per FV-PBT-FLOOR-BUILD-SPEC.md §3 instead of ULP forcing. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to the kernel it
// imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-287-revocation-status-verifier.proptest.mjs

import { compute } from '../art-287-revocation-status-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-287-revocation-status-verifier.fixtures.json');
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
const rand = mulberry32(0x287B10);
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Local (test-side) base64url encoder mirroring the kernel's own decoder — pure bytes-to-string,
// used only to construct random-but-valid encodedList fixtures for the properties below.
function base64urlEncode(bytes) {
  let out = '', buffer = 0, bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64URL_ALPHABET[(buffer >> bits) & 0x3f];
    }
  }
  if (bits > 0) out += B64URL_ALPHABET[(buffer << (6 - bits)) & 0x3f];
  return out;
}

function randomBytes(rng, n) {
  const bytes = [];
  for (let i = 0; i < n; i++) bytes.push(Math.floor(rng() * 256));
  return bytes;
}

const TRIALS = 8000;

function mkPP(rng) {
  const nBytes = 1 + Math.floor(rng() * 32);
  const bytes = randomBytes(rng, nBytes);
  const index = Math.floor(rng() * nBytes * 8);
  return {
    credential_status: { statusListCredential: 'https://example.org/status/1', statusListIndex: index, type: 'BitstringStatusListEntry' },
    status_list_credential: { encodedList: base64urlEncode(bytes) },
    __bytes: bytes, __index: index,
  };
}

function bitAtRef(bytes, index) {
  const byteIndex = Math.floor(index / 8);
  const bitOffset = index % 8;
  return (bytes[byteIndex] >> (7 - bitOffset)) & 1;
}

// ---------- P1: round-trip identity — status decoded matches an independent bit-extraction reference ----------
function checkP1_bitDecodeIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedBit = bitAtRef(pp.__bytes, pp.__index);
    const expectedStatus = expectedBit === 1 ? 'revoked' : 'active';
    if (r.output_payload.status !== expectedStatus) violations++;
    if (r.output_payload.revoked_for_purpose !== (expectedBit === 1)) violations++;
  }
  return { name: 'P1_status_matches_independent_bit_extraction_reference', trials: checked, violations };
}

// ---------- P2: boundedness — status always in the known 3-value set, structural_error null iff status != no-signal-from-error ----------
function checkP2_boundedness() {
  const KNOWN = new Set(['revoked', 'active', 'no-signal']);
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!KNOWN.has(r.output_payload.status)) violations++;
    if (r.output_payload.status !== 'no-signal' && r.output_payload.structural_error !== null) violations++;
  }
  return { name: 'P2_status_known_set_structural_error_null_when_not_no_signal', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — absence of credentialStatus always yields no-signal, never active/revoked ----------
function checkP3_absenceIsNoSignal() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute({ status_list_credential: pp.status_list_credential });
    checked++;
    if (r.output_payload.status !== 'no-signal') violations++;
    if (!r.compliance_flags.includes('REVOKE_STATUS_NO_SIGNAL')) violations++;
  }
  return { name: 'P3_absent_credential_status_always_no_signal_never_active_or_revoked', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
const VALID_CS = { statusListCredential: 'https://example.org/status/1', statusListIndex: 0, type: 'BitstringStatusListEntry' };
const VALID_SLC = { encodedList: base64urlEncode([0x00]) };
const CATEGORICAL_BOUNDARY_CASES = [
  [{ credential_status: null, status_list_credential: VALID_SLC }, 'credentialStatus entirely absent (null) — must be no-signal, never active/revoked'],
  [{ credential_status: { ...VALID_CS, type: 'WrongType' }, status_list_credential: VALID_SLC }, 'wrong credentialStatus.type — structural error, no-signal'],
  [{ credential_status: { ...VALID_CS, statusListIndex: -1 }, status_list_credential: VALID_SLC }, 'statusListIndex negative — must fail Number.isInteger&&>=0 check'],
  [{ credential_status: { ...VALID_CS, statusListIndex: 1.5 }, status_list_credential: VALID_SLC }, 'statusListIndex non-integer — must fail Number.isInteger check'],
  [{ credential_status: VALID_CS, status_list_credential: null }, 'status_list_credential entirely absent — must be structural error (no encodedList)'],
  [{ credential_status: VALID_CS, status_list_credential: { encodedList: '' } }, 'encodedList empty string — must fail the length check'],
  [{ credential_status: VALID_CS, status_list_credential: { encodedList: '!!!invalid!!!' } }, 'encodedList with invalid base64url characters — must fail decode, no-signal'],
  [{ credential_status: { ...VALID_CS, statusListIndex: 999999 }, status_list_credential: { encodedList: base64urlEncode([0xff]) } }, 'statusListIndex far out of range for a 1-byte (8-bit) list — must be structural error, not throw'],
  [{ credential_status: { ...VALID_CS, statusListIndex: 0 }, status_list_credential: { encodedList: base64urlEncode(Array(9000).fill(0)) } }, 'decoded list exceeds MAX_LIST_BYTES(8192) — must be structural error, not throw or hang'],
  [{ credential_status: { ...VALID_CS, statusListIndex: 0 }, status_list_credential: { encodedList: base64urlEncode([0x80]) } }, 'bit 0 exactly at MSB set (0x80) — status must be revoked, bit indexing is MSB-first per byte'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    let threw = false, r;
    try { r = compute(pp); } catch (e) { threw = true; r = { output_payload: {} }; }
    rows.push({ label, status: r.output_payload.status, structural_error: r.output_payload.structural_error, threw, plausible: !threw });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bitDecodeIdentity());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_absenceIsNoSignal());
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

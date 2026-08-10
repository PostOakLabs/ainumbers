// art-200-license-election-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:a0aa948c199ee9e9b22b9f8c9e710dba6a6762acfa6cee243e6f2a9669dab881
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU triage table lists this kernel float:yes; direct source read finds the
// ONLY numeric operations are inside the inlined pure-JS SHA-256 -- 32-bit unsigned integer
// arithmetic with >>> masking throughout, no IEEE-754 division/comparison anywhere. CORRECTED to
// float:no per FIX-2 discipline; no ULP-forcing applies. This correction is stated in the manifest.)
// Checks: fixture-oracle gate, termination (checks array is either 1 (malformed) or exactly 5
// (well-formed) -- bounded by a fixed constant, never by cert content size), boundedness (verdict
// is always one of a fixed enum), differential re-derivation of terms_hash via an INDEPENDENT
// node:crypto SHA-256 over the same JCS-canonical election_core (node:crypto is a Node built-in,
// not an added dependency), and metamorphic single-byte-flip sensitivity on terms_hash (any single
// character mutation of a valid terms_hash must flip binding_ok to false).
// Zero external dependencies beyond node:crypto (Node built-in) — no fast-check, no npm package.
//
// Run: node chaingraph/kernels/__proptests__/art-200-license-election-verifier.proptest.mjs

import { compute } from '../art-200-license-election-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-200-license-election-verifier.fixtures.json');
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
const rand = mulberry32(0x2000A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Same JCS canonicalization the kernel uses (Object.keys().sort()).
function cgCanon(v) {
  return Array.isArray(v) ? v.map(cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;
}
function independentTermsHash(electionCore) {
  return createHash('sha256').update(JSON.stringify(cgCanon(electionCore)), 'utf8').digest('hex');
}

function randomCert(rng, { validTermsHash = true } = {}) {
  const asset_ref = `asset-${Math.floor(rng() * 1e6)}`;
  const licensor_did = `did:example:${Math.floor(rng() * 1e6)}`;
  const license_election = { family: pick(rng, ['cc', 'pil', 'cbe']), id: `LIC-${Math.floor(rng() * 100)}` };
  const election_core = { asset_ref, licensor_did, license_election };
  const terms_hash = validTermsHash
    ? independentTermsHash(election_core)
    : `${Math.floor(rng() * 1e16).toString(16).padStart(16, '0')}`;
  return { certificate_version: '1.0', asset_ref, licensor_did, license_election, terms_hash };
}

const TRIALS = 5000;

// ---------- P1: termination — checks.length is either 1 (malformed) or exactly 5 (well-formed) ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const wellFormed = rand() < 0.7;
    const certificate = wellFormed ? randomCert(rand, { validTermsHash: rand() < 0.5 }) : { certificate_version: '1.0' };
    const { output_payload } = compute({ certificate });
    checked++;
    const n = output_payload.checks.length;
    if (wellFormed ? n !== 5 : n !== 1) violations++;
  }
  return { name: 'P1_termination_checks_length_fixed', trials: checked, violations };
}

// ---------- P2 (differential): recomputed_terms_hash matches an INDEPENDENT node:crypto SHA-256 ----------
function checkP2_hash_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const certificate = randomCert(rand, { validTermsHash: rand() < 0.5 });
    const { output_payload } = compute({ certificate });
    checked++;
    const election_core = { asset_ref: certificate.asset_ref, licensor_did: certificate.licensor_did, license_election: certificate.license_election };
    const expectedHash = independentTermsHash(election_core);
    if (output_payload.recomputed_terms_hash !== expectedHash) violations++;
    const expectedBindingOk = expectedHash === String(certificate.terms_hash).toLowerCase();
    if (output_payload.binding_ok !== expectedBindingOk) violations++;
  }
  return { name: 'P2_terms_hash_differential_vs_node_crypto', trials: checked, violations };
}

// ---------- P3: boundedness — verdict is always one of the fixed enum ----------
function checkP3_verdict_bounded() {
  const VALID = new Set(['malformed', 'binding_mismatch', 'incomplete_fields', 'valid']);
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const wellFormed = rand() < 0.7;
    const certificate = wellFormed ? randomCert(rand, { validTermsHash: rand() < 0.5 }) : { certificate_version: '1.0' };
    const { output_payload } = compute({ certificate });
    checked++;
    if (!VALID.has(output_payload.verdict)) violations++;
  }
  return { name: 'P3_verdict_bounded_enum', trials: checked, violations };
}

// ---------- P4: metamorphic — flipping one char of a VALID terms_hash flips binding_ok to false ----------
function checkP4_single_byte_flip_sensitivity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const cert = randomCert(rand, { validTermsHash: true });
    const r1 = compute({ certificate: cert }).output_payload;
    checked++;
    if (r1.binding_ok !== true) { violations++; continue; }
    const idx = Math.floor(rand() * cert.terms_hash.length);
    const chars = cert.terms_hash.split('');
    const orig = chars[idx];
    const alt = orig === '0' ? '1' : '0';
    chars[idx] = alt;
    const flipped = { ...cert, terms_hash: chars.join('') };
    const r2 = compute({ certificate: flipped }).output_payload;
    if (r2.binding_ok !== false) violations++;
  }
  return { name: 'P4_single_byte_flip_breaks_binding', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_hash_differential());
results.properties.push(checkP3_verdict_bounded());
results.properties.push(checkP4_single_byte_flip_sensitivity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-200-license-election-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

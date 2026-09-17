// art-124-content-credential-signature-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:815b73ede91f61e07afc98d9ac7e04f808c7c477c00535e5f0817df1f041bca9
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (since v1.1.0 the kernel takes `signature_verified` as an attested boolean
//   input; the kernel's own logic is pure boolean/set-membership decision logic — no arithmetic,
//   no thresholds, no async primitive).
// Checks: fixture-oracle gate, termination (sync compute always returns — no unbounded loop; alg
// allowlist is a fixed 4-entry table), differential re-derivation of chain_trusted/verdict from
// the attested signature boolean and the trust-posture booleans, and a boundedness check that
// verdict is always ACCEPT iff both the attested signature verification AND chain trust hold.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-124-content-credential-signature-verifier.proptest.mjs

import { compute } from '../art-124-content-credential-signature-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-124-content-credential-signature-verifier.fixtures.json');
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
const rand = mulberry32(0x124C4);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

const ALGS = ['Ed25519', 'ES256', 'ES384', 'PS256', 'RS512-BOGUS'];

// `signature_verified` is the REQUIRED attested input: randomized across true/false/absent so the
// decision logic around the boolean (including the absent -> false coercion) is exercised directly.
// The caller-supplied key/signature material fields are kept in the shape for input realism; the
// policy core reads none of them.
function randomPP(rng) {
  return {
    alg: pick(rng, ALGS),
    signature_verified: pick(rng, [true, false, undefined]),
    signer_public_key_jwk: maybe(rng, { kty: 'OKP', crv: 'Ed25519', x: 'garbage-not-base64url!!' }, 0.6),
    signed_bytes_b64: maybe(rng, Buffer.from(`msg-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    signature_b64: maybe(rng, Buffer.from(`sig-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    trust_anchor_match: pick(rng, [true, false, undefined]),
    cert_not_expired: pick(rng, [true, false, undefined]),
    revocation_status: pick(rng, ['good', 'revoked', 'unknown', undefined]),
  };
}

const TRIALS = 2000; // sync pure-boolean policy — ample coverage at negligible cost

// ---------- P1: termination — compute always returns a well-shaped payload, alg_allowed is a fixed 4-alg table ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const ALLOWED = new Set(['Ed25519', 'ES256', 'ES384', 'PS256']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.alg_allowed !== ALLOWED.has(pp.alg)) violations++;
    if (typeof output_payload.signature_verified !== 'boolean') violations++;
    if (output_payload.signature_verification !== 'caller_attested') violations++;
  }
  return { name: 'P1_termination_alg_table_bounded', trials: checked, violations };
}

// ---------- P2 (differential): chain_trusted + verdict re-derivation ----------
function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expectedChainTrusted = pp.trust_anchor_match === true && pp.cert_not_expired !== false && pp.revocation_status !== 'revoked';
    if (output_payload.chain_trusted !== expectedChainTrusted) violations++;
    const expectedVerified = pp.signature_verified === true;
    if (output_payload.signature_verified !== expectedVerified) violations++;
    const expectedVerdict = (expectedVerified && expectedChainTrusted) ? 'ACCEPT' : 'REFUSE';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — verdict is ACCEPT iff signature_verified AND chain_trusted ----------
function checkP3_accept_iff_both() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const bothTrue = output_payload.signature_verified && output_payload.chain_trusted;
    if (bothTrue !== (output_payload.verdict === 'ACCEPT')) violations++;
  }
  return { name: 'P3_accept_iff_signature_and_chain', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_verdict_differential());
results.properties.push(checkP3_accept_iff_both());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-124-content-credential-signature-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

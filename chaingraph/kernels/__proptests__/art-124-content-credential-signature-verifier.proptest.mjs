// art-124-content-credential-signature-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:e9897ef4cb8f7cf9529ef898e949895809edb037f346eb0a0557216bb3875fd1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WebCrypto verify() returns a boolean; the kernel's own logic around it is
//   pure boolean/set-membership decision logic — no arithmetic, no thresholds).
// Checks: fixture-oracle gate, termination (compute always resolves — no unbounded loop; alg
// allowlist is a fixed 4-entry table), differential re-derivation of chain_trusted/verdict from
// the trust-posture booleans (independent of the actual cryptographic outcome, which the fixture
// oracle already covers with real keys), and a boundedness check that verdict is always ACCEPT iff
// both signature validity AND chain trust hold.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled). Uses the
// runtime's real globalThis.crypto.subtle (Node 19+ WebCrypto) exactly as production does.
//
// Run: node chaingraph/kernels/__proptests__/art-124-content-credential-signature-verifier.proptest.mjs

import { compute } from '../art-124-content-credential-signature-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-124-content-credential-signature-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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

// Deliberately malformed/random JWK + signature/bytes — signature_cryptographically_valid will be
// false almost surely (importKey/verify fail on garbage material) or throw (caught -> false). This
// exercises the decision logic around the boolean, not the crypto math itself (fixture oracle does that).
function randomPP(rng) {
  return {
    alg: pick(rng, ALGS),
    signer_public_key_jwk: maybe(rng, { kty: 'OKP', crv: 'Ed25519', x: 'garbage-not-base64url!!' }, 0.6),
    signed_bytes_b64: maybe(rng, Buffer.from(`msg-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    signature_b64: maybe(rng, Buffer.from(`sig-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    trust_anchor_match: pick(rng, [true, false, undefined]),
    cert_not_expired: pick(rng, [true, false, undefined]),
    revocation_status: pick(rng, ['good', 'revoked', 'unknown', undefined]),
  };
}

const TRIALS = 2000; // WebCrypto import/verify calls are more expensive than pure JS — fewer trials, still ample coverage

// ---------- P1: termination — compute always resolves with a well-shaped payload, alg_allowed is a fixed 4-alg table ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  const ALLOWED = new Set(['Ed25519', 'ES256', 'ES384', 'PS256']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.alg_allowed !== ALLOWED.has(pp.alg)) violations++;
    if (typeof output_payload.signature_cryptographically_valid !== 'boolean') violations++;
  }
  return { name: 'P1_termination_alg_table_bounded', trials: checked, violations };
}

// ---------- P2 (differential): chain_trusted + verdict re-derivation ----------
async function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const expectedChainTrusted = pp.trust_anchor_match === true && pp.cert_not_expired !== false && pp.revocation_status !== 'revoked';
    if (output_payload.chain_trusted !== expectedChainTrusted) violations++;
    const expectedVerdict = (output_payload.signature_cryptographically_valid && expectedChainTrusted) ? 'ACCEPT' : 'REFUSE';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — verdict is ACCEPT iff signature_cryptographically_valid AND chain_trusted ----------
async function checkP3_accept_iff_both() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const bothTrue = output_payload.signature_cryptographically_valid && output_payload.chain_trusted;
    if (bothTrue !== (output_payload.verdict === 'ACCEPT')) violations++;
  }
  return { name: 'P3_accept_iff_signature_and_chain', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_verdict_differential());
results.properties.push(await checkP3_accept_iff_both());

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

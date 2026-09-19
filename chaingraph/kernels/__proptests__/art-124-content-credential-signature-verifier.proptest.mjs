// art-124-content-credential-signature-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:77e22bf535acef4199273ffb7f0dec6835538f4fc3b880d9b0685c8c01fe3c4a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (the kernel's own logic is boolean/set-membership decision logic — no
//   arithmetic, no thresholds).
// ⚠ ASYNC since v1.2.0: the kernel performs the signature check ITSELF through `_sigverify.mjs`
//   (WebCrypto in the page and in Node, native accelerated verification inside the art-124 guest
//   image), so `compute` returns a promise and every call site here awaits it.
// Checks: fixture-oracle gate, termination (the alg allowlist is a fixed 4-entry table and compute
// always returns a well-shaped payload), differential re-derivation of chain_trusted/verdict, a
// boundedness check that verdict is ACCEPT iff signature AND chain trust hold, and — new in v1.2.0
// and the property that actually matters now that the check is real — that random/garbage key and
// signature material NEVER verifies.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
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

// Random inputs carry random key/signature material. None of it is a real signature, so the
// cryptographic answer is always `false` — which is exactly what P4 asserts.
function randomPP(rng) {
  return {
    alg: pick(rng, ALGS),
    signer_public_key_jwk: maybe(rng, {
      kty: 'OKP', crv: 'Ed25519',
      x: Buffer.from(`k-${Math.floor(rng() * 1e9)}`).toString('base64url'),
    }, 0.6),
    signed_bytes_b64: maybe(rng, Buffer.from(`msg-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    signature_b64: maybe(rng, Buffer.from(`sig-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    trust_anchor_match: pick(rng, [true, false, undefined]),
    cert_not_expired: pick(rng, [true, false, undefined]),
    revocation_status: pick(rng, ['good', 'revoked', 'unknown', undefined]),
  };
}

// Lower than v1.1.0's 2000: every trial now runs real WebCrypto importKey attempts rather than a
// pure boolean branch. 400 trials still exercise every branch of the allowlist and trust table many
// times over, and the suite stays well inside its CI budget.
const TRIALS = 400;

// Draw the trial corpus ONCE and share it across the properties, so each property sees the same
// inputs and one async pass covers all of them.
async function corpus() {
  const rows = [];
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    rows.push({ pp, output_payload });
  }
  return rows;
}

// ---------- P1: termination — compute always returns a well-shaped payload, alg_allowed is a fixed 4-alg table ----------
function checkP1_termination(rows) {
  let violations = 0;
  const ALLOWED = new Set(['Ed25519', 'ES256', 'ES384', 'PS256']);
  for (const { pp, output_payload } of rows) {
    if (output_payload.alg_allowed !== ALLOWED.has(pp.alg)) violations++;
    if (typeof output_payload.signature_verified !== 'boolean') violations++;
    if (output_payload.signature_verification !== 'kernel_verified') violations++;
  }
  return { name: 'P1_termination_alg_table_bounded', trials: rows.length, violations };
}

// ---------- P2 (differential): chain_trusted + verdict re-derivation ----------
function checkP2_verdict_differential(rows) {
  let violations = 0;
  for (const { pp, output_payload } of rows) {
    const expectedChainTrusted = pp.trust_anchor_match === true && pp.cert_not_expired !== false && pp.revocation_status !== 'revoked';
    if (output_payload.chain_trusted !== expectedChainTrusted) violations++;
    const expectedVerdict = (output_payload.signature_verified === true && expectedChainTrusted) ? 'ACCEPT' : 'REFUSE';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }
  return { name: 'P2_verdict_differential', trials: rows.length, violations };
}

// ---------- P3: boundedness — verdict is ACCEPT iff signature_verified AND chain_trusted ----------
function checkP3_accept_iff_both(rows) {
  let violations = 0;
  for (const { output_payload } of rows) {
    const bothTrue = output_payload.signature_verified && output_payload.chain_trusted;
    if (bothTrue !== (output_payload.verdict === 'ACCEPT')) violations++;
  }
  return { name: 'P3_accept_iff_signature_and_chain', trials: rows.length, violations };
}

// ---------- P4: soundness — random key/signature material NEVER verifies ----------
// The property the v1.1.0 floor could not state, because the kernel did not do the check. A single
// violation here means the verifier accepts something nobody signed.
function checkP4_no_forgery(rows) {
  let violations = 0;
  for (const { output_payload } of rows) {
    if (output_payload.signature_verified === true) violations++;
  }
  return { name: 'P4_random_material_never_verifies', trials: rows.length, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const rows = await corpus();
results.properties.push(checkP1_termination(rows));
results.properties.push(checkP2_verdict_differential(rows));
results.properties.push(checkP3_accept_iff_both(rows));
results.properties.push(checkP4_no_forgery(rows));

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

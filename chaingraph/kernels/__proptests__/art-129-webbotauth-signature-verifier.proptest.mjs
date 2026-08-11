// art-129-webbotauth-signature-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:5274be35695e7e38d8fc3b42148a9446bad7a77fa7af42574be4eaeeadc2c31a
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (the only arithmetic is integer-second clock-skew comparison against
//   fixed integer bounds — no floating point involved).
// Checks: fixture-oracle gate, termination (covered_components array is caller-bounded, the
// signature-base string built from it is linear in that length, never unbounded recursion),
// differential re-derivation of alg_ok/tag_ok/fresh/verdict from the input booleans/strings, and
// a boundedness check on the freshness window (fresh is exactly the closed clock-skew interval).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled). Ed25519
// verification runs through the vendored _noble-ed25519.bundle.mjs exactly as the kernel does; it
// no longer touches globalThis.crypto.subtle, which the zkVM guest does not have. A synchronicity
// property below pins compute() to a plain (non-thenable) return so it cannot drift back to async.
//
// Run: node chaingraph/kernels/__proptests__/art-129-webbotauth-signature-verifier.proptest.mjs

import { compute } from '../art-129-webbotauth-signature-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-129-webbotauth-signature-verifier.fixtures.json');
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
const rand = mulberry32(0x129C9);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

function randomPP(rng) {
  const n = Math.floor(rng() * 5);
  const created = 1_000_000 + Math.floor(rng() * 10000);
  const now_unix = created + Math.floor(rng() * 8000) - 4000; // spans well outside/inside the default 3600s window incl. -300s skew tolerance
  return {
    covered_components: Array.from({ length: n }, (_, i) => ({ name: `x-comp-${i}`, value: `"v${i}"` })),
    signature_params: pick(rng, [`sig1=("x-comp-0");created=${created};tag="web-bot-auth"`, `sig1=();tag="other"`, undefined]),
    signature_b64: maybe(rng, Buffer.from(`sig-${Math.floor(rng() * 1e6)}`).toString('base64'), 0.8),
    public_key_jwk: maybe(rng, { kty: 'OKP', crv: 'Ed25519', x: 'garbage-not-base64url!!' }, 0.6),
    expected_tag: 'web-bot-auth',
    alg: pick(rng, ['ed25519', 'rsa', undefined]),
    created,
    now_unix,
    max_age_s: pick(rng, [3600, 60, 0]),
  };
}

const TRIALS = 2000; // WebCrypto import/verify calls are more expensive than pure JS — fewer trials, still ample coverage

// ---------- P1: termination — compute always resolves; output shape independent of covered_components length ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    if (typeof output_payload.signature_cryptographically_valid !== 'boolean') violations++;
    if (!['ACCEPT', 'REFUSE'].includes(output_payload.verdict)) violations++;
  }
  return { name: 'P1_termination_output_shape_bounded', trials: checked, violations };
}

// ---------- P2 (differential): alg_ok/tag_ok/fresh/verdict re-derivation ----------
async function checkP2_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const alg_ok = pp.alg === 'ed25519';
    if (output_payload.alg_ok !== alg_ok) violations++;
    const tag_ok = typeof pp.signature_params === 'string' && pp.signature_params.includes(`tag="${pp.expected_tag}"`);
    if (output_payload.tag_ok !== tag_ok) violations++;
    const fresh = (typeof pp.created === 'number' && typeof pp.now_unix === 'number')
      ? (pp.now_unix - pp.created) <= pp.max_age_s && (pp.now_unix - pp.created) >= -300
      : null;
    if (output_payload.fresh !== fresh) violations++;
    const expectedVerdict = (output_payload.signature_cryptographically_valid && alg_ok && tag_ok && fresh !== false) ? 'ACCEPT' : 'REFUSE';
    if (output_payload.verdict !== expectedVerdict) violations++;
  }
  return { name: 'P2_verdict_differential', trials: checked, violations };
}

// ---------- P3: boundedness — freshness window is the closed integer interval [-300, max_age_s] ----------
async function checkP3_freshness_window_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const delta = pp.now_unix - pp.created;
    const expectedInWindow = delta >= -300 && delta <= pp.max_age_s;
    if (output_payload.fresh !== expectedInWindow) violations++;
  }
  return { name: 'P3_freshness_window_boundedness', trials: checked, violations };
}

// ---------- P4: synchronicity — compute() must return a plain object, never a thenable ----------
// The zkVM guest calls compute(pp) and canonicalizes the result directly. A thenable canonicalizes
// to {} and the receipt then attests nothing while every gate still reads green, which is exactly
// the defect this kernel was converted to fix. Pinned as a property so it cannot come back.
function checkP4_compute_is_synchronous() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 64; i++) {
    const out = compute(randomPP(rand));
    checked++;
    if (out === null || typeof out !== 'object') { violations++; continue; }
    if (typeof out.then === 'function') { violations++; continue; }
    if (Object.keys(out).length === 0) violations++;
  }
  return { name: 'P4_compute_is_synchronous', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_verdict_differential());
results.properties.push(await checkP3_freshness_window_bounded());
results.properties.push(checkP4_compute_is_synchronous());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-129-webbotauth-signature-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

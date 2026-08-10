// art-26-x402-payload-decoder-flow-simulator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:3e47e2ed8b75c0eacebb1bad77f5deb167321634e9040fc3f7cadc125b7090b3
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: NO (score arithmetic is small-integer clamp, no
// division/transcendentals) — forced categorical boundary cases used instead of ULP-forcing.
// Checks: fixture-oracle gate, termination (findings bounded, always halts on malformed input),
// boundedness (score in [0,100]), differential re-derivation of score from errors/warnings, forced
// categorical edges (empty/malformed/huge JSON, non-object JSON, base64 round-trip), and a metamorphic
// property (base64-wrapping a payload does not change its lint findings).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-26-x402-payload-decoder-flow-simulator.proptest.mjs

import { compute } from '../art-26-x402-payload-decoder-flow-simulator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-26-x402-payload-decoder-flow-simulator.fixtures.json');
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
const rand = mulberry32(0x26A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const SCHEMES = ['exact', 'upto', 'weird-scheme'];
const NETWORKS = ['base', 'base-sepolia', 'polygon', 'unknown-net'];
const TRIALS = 5000;

function randomPayloadObj(rng) {
  const obj = { scheme: pick(rng, SCHEMES), network: pick(rng, NETWORKS) };
  if (rng() < 0.7) obj.x402Version = 1;
  if (rng() < 0.8) obj.payload = { signature: rng() < 0.7 ? '0xabc' : undefined };
  if (obj.scheme === 'exact' && obj.payload && rng() < 0.5) {
    obj.payload.authorization = { from: 'a', to: 'b', value: '100', validAfter: 1, validBefore: rng() < 0.5 ? 2 : 0, nonce: 'n' };
  }
  return obj;
}
function randomInput(rng) {
  const kind = pick(rng, ['payload_json', 'payload_b64', 'garbage', 'empty', 'request', 'response']);
  if (kind === 'payload_json') return JSON.stringify(randomPayloadObj(rng));
  if (kind === 'payload_b64') return Buffer.from(JSON.stringify(randomPayloadObj(rng))).toString('base64');
  if (kind === 'garbage') return 'not json at all ' + Math.floor(rng() * 1e9);
  if (kind === 'empty') return '';
  if (kind === 'request') return JSON.stringify({ accepts: [], error: rng() < 0.5 ? 'err' : undefined });
  return JSON.stringify({ success: true, transaction: '0xdead' });
}

// ---------- P1: termination — every random/malformed input returns a well-shaped, finite result ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const input = randomInput(rand);
    const { output_payload } = compute({ header_or_payload: input });
    checked++;
    if (typeof output_payload !== 'object' || output_payload === null) violations++;
    if (!Array.isArray(output_payload.findings)) violations++;
    if (!Number.isFinite(output_payload.score)) violations++;
  }
  return { name: 'P1_termination_wellshaped_finite_result', trials: checked, violations };
}

// ---------- P2: boundedness — score always in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const input = randomInput(rand);
    const { output_payload } = compute({ header_or_payload: input });
    checked++;
    if (output_payload.score < 0 || output_payload.score > 100) violations++;
    if (output_payload.errors < 0 || output_payload.warnings < 0 || output_payload.passes < 0) violations++;
  }
  return { name: 'P2_boundedness_score_0_100', trials: checked, violations };
}

// ---------- P3: differential — score re-derived independently from errors/warnings clamp formula ----------
function checkP3_score_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const input = randomInput(rand);
    const { output_payload } = compute({ header_or_payload: input });
    checked++;
    let expected = 100 - output_payload.errors * 15 - output_payload.warnings * 4;
    if (expected < 0) expected = 0;
    if (expected > 100) expected = 100;
    if (output_payload.score !== expected) violations++;
  }
  return { name: 'P3_score_differential_reconstruction', trials: checked, violations };
}

// ---------- P4 (forced categorical, float_sensitive:no) ----------
const FORCED_CASES = [
  { label: 'empty string input', header_or_payload: '' },
  { label: 'whitespace-only input', header_or_payload: '   ' },
  { label: 'malformed JSON', header_or_payload: '{not valid' },
  { label: 'non-object JSON (array)', header_or_payload: '[1,2,3]' },
  { label: 'non-object JSON (number)', header_or_payload: '42' },
  { label: 'PaymentPayload with zero findings issues', header_or_payload: JSON.stringify({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x1', authorization: { from: 'a', to: 'b', value: '1', validAfter: 1, validBefore: 2, nonce: 'n' } } }) },
  { label: 'validBefore <= validAfter (error case)', header_or_payload: JSON.stringify({ scheme: 'exact', network: 'base', payload: { signature: '0x1', authorization: { validAfter: 5, validBefore: 5 } } }) },
  { label: 'huge base64 wrapper of minimal payload', header_or_payload: Buffer.from(JSON.stringify({ scheme: 'upto', network: 'polygon', payload: { signature: '0x1' } })).toString('base64') },
  { label: 'header-prefixed base64 (X-PAYMENT: prefix)', header_or_payload: 'X-PAYMENT: ' + Buffer.from(JSON.stringify({ scheme: 'exact', network: 'base', payload: { signature: '0x1' } })).toString('base64') },
];
function checkP4_forced() {
  const rows = [];
  for (const c of FORCED_CASES) {
    const { output_payload } = compute({ header_or_payload: c.header_or_payload });
    rows.push({
      label: c.label,
      score: output_payload.score,
      decoded_type: output_payload.decoded_type,
      errors: output_payload.errors,
      finite: Number.isFinite(output_payload.score) && output_payload.score >= 0 && output_payload.score <= 100,
    });
  }
  return rows;
}

// ---------- P5: metamorphic — base64-wrapping a PaymentPayload JSON yields identical findings ----------
function checkP5_base64_metamorphic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const obj = randomPayloadObj(rand);
    const jsonInput = JSON.stringify(obj);
    const b64Input = Buffer.from(jsonInput).toString('base64');
    const r1 = compute({ header_or_payload: jsonInput }).output_payload;
    const r2 = compute({ header_or_payload: b64Input }).output_payload;
    checked++;
    if (JSON.stringify(r1.findings) !== JSON.stringify(r2.findings)) violations++;
    if (r1.score !== r2.score) violations++;
    if (r1.decoded_type !== r2.decoded_type) violations++;
  }
  return { name: 'P5_metamorphic_base64_wrap_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_score_differential());
results.properties.push(checkP5_base64_metamorphic());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-26-x402-payload-decoder-flow-simulator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);

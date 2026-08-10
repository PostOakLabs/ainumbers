// art-210-ipfs-cid-computer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:dac326da6a1226cfd8f7e34a91e43143f1b9721fe0de9210224b8cb275eef503
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — SHA-256 is 32-bit unsigned integer arithmetic
// throughout, base32 encode is bit-shift only, no IEEE-754 operations anywhere in the file).
// Checks: fixture-oracle gate, termination (SHA-256 compression loop is exactly bounded by the
// padded message length, itself a deterministic function of input byte length -- tested via exact
// byte-length accounting), boundedness (digest_hex is always 64 lowercase hex chars, cid always
// starts with 'b' + RFC4648 base32-lowercase alphabet), a differential re-derivation of digest_hex
// via an INDEPENDENT node:crypto SHA-256 (node:crypto is a Node built-in, not an added dependency),
// and metamorphic determinism + codec-invariance (same text always yields the same digest_hex
// regardless of codec choice; only the codec byte/codec field differ between raw and dag-pb).
// Zero external dependencies beyond node:crypto (Node built-in) — no fast-check, no npm package.
//
// Run: node chaingraph/kernels/__proptests__/art-210-ipfs-cid-computer.proptest.mjs

import { compute } from '../art-210-ipfs-cid-computer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-210-ipfs-cid-computer.fixtures.json');
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
const rand = mulberry32(0x210A00);

function randomText(rng, maxLen) {
  const n = Math.floor(rng() * maxLen);
  const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,-_é中';
  let s = '';
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(rng() * CHARS.length)];
  return s;
}

const CID_RE = /^b[abcdefghijklmnopqrstuvwxyz234567]+$/;
const TRIALS = 5000;

// ---------- P1: termination — byte-length accounting is exact ----------
function checkP1_termination_byte_accounting() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const text = randomText(rand, 1000);
    const { output_payload } = compute({ text });
    checked++;
    if (output_payload.byte_length !== Buffer.byteLength(text, 'utf8')) violations++;
  }
  return { name: 'P1_termination_byte_length_exact', trials: checked, violations };
}

// ---------- P2 (differential): digest_hex matches an INDEPENDENT node:crypto SHA-256 ----------
function checkP2_digest_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const text = randomText(rand, 1000);
    const { output_payload } = compute({ text });
    checked++;
    const expected = createHash('sha256').update(text, 'utf8').digest('hex');
    if (output_payload.digest_hex !== expected) violations++;
  }
  return { name: 'P2_digest_differential_vs_node_crypto', trials: checked, violations };
}

// ---------- P3: boundedness — digest_hex 64 hex chars, cid well-formed base32 ----------
function checkP3_digest_and_cid_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const text = randomText(rand, 1000);
    const { output_payload } = compute({ text });
    checked++;
    if (!/^[0-9a-f]{64}$/.test(output_payload.digest_hex)) violations++;
    if (!CID_RE.test(output_payload.cid)) violations++;
    if (output_payload.digest_length !== 32) violations++;
  }
  return { name: 'P3_digest_hex64_and_cid_base32_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — determinism + codec-invariance of digest_hex ----------
function checkP4_determinism_and_codec_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const text = randomText(rand, 500);
    const r1 = compute({ text }).output_payload;
    const r2 = compute({ text }).output_payload;
    checked++;
    if (r1.cid !== r2.cid) violations++; // determinism
    const raw = compute({ text, codec: 'raw' }).output_payload;
    const dagpb = compute({ text, codec: 'dag-pb' }).output_payload;
    if (raw.digest_hex !== dagpb.digest_hex) violations++; // codec never affects the digest itself
    if (raw.cid === dagpb.cid) violations++; // but codec byte differs, so the CID string must differ
  }
  return { name: 'P4_determinism_and_codec_invariance', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_byte_accounting());
results.properties.push(checkP2_digest_differential());
results.properties.push(checkP3_digest_and_cid_bounded());
results.properties.push(checkP4_determinism_and_codec_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-210-ipfs-cid-computer',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

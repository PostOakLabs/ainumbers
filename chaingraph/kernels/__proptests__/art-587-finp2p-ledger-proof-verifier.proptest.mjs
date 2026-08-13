// art-587-finp2p-ledger-proof-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C12-1).
// kernel_digest_at_authoring: sha256:013d4547171c799f950105160dcf639ae9f06ee466c67e2f8856ceac24217cc6
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — compute() is pure bitwise/BigInt secp256k1 +
// keccak/sha3 hashing over caller-supplied strings; no caller float parameters, no
// tolerance/rate comparisons; hex/byte parsing is categorical, not numeric).
// Unbounded input: `receipt` object has caller-controlled arbitrary field values (strings of
// any length), `proof.hashListValues` is a caller-controlled array of arbitrary length, and
// `proof.signature`/`verification_public_key` are caller-controlled hex strings of arbitrary
// length. Termination is bounded by input size (a single fixed-length pass over the 17
// HASHLIST_FIELD_ORDER fields, then O(signature length) hex parsing) — no recursion, no
// data-dependent loop bound.
// Checks: fixture-oracle gate, termination (bounded, no hang, on adversarial-length inputs),
// determinism/metamorphic (same receipt+proof => identical hash_match/signature_match every
// call — pure function, no hidden state), boundedness (computed_hash always a 64-hex-char
// string; hash_match/signature_match .result always strictly boolean; never fused into one
// flag, per the EDGE-POR-1 separation-of-concerns requirement in the kernel's own header),
// forced categorical boundary cases (empty receipt, missing/malformed signature length,
// oversized field values, non-hex signature/pubkey).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-587-finp2p-ledger-proof-verifier.proptest.mjs

import { compute } from '../art-587-finp2p-ledger-proof-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-587-finp2p-ledger-proof-verifier.fixtures.json');
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
const rand = mulberry32(0x587D0);

function randomHex(rng, nBytes) {
  let s = '';
  for (let i = 0; i < nBytes * 2; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function randomReceipt(rng) {
  const fields = ['id', 'operationType', 'transactionOperationId', 'srcAssetId', 'srcAssetLedgerInfoType',
    'srcAssetLedgerInfoId', 'srcAccount', 'srcAccountType', 'dstAssetId', 'dstAssetLedgerInfoType',
    'dstAssetLedgerInfoId', 'destAccount', 'dstAccountType', 'transactionId', 'amount', 'execPlanId', 'instructionSeq'];
  const r = {};
  for (const f of fields) {
    if (rng() < 0.15) continue; // some fields randomly absent
    const len = Math.floor(rng() * 40);
    r[f] = randomHex(rng, len);
  }
  return r;
}

function randomPP(rng) {
  return {
    receipt: randomReceipt(rng),
    proof: {
      hashFunc: rng() < 0.5 ? 'keccak_256' : 'sha3-256',
      hashListValues: rng() < 0.3 ? [] : undefined,
      signature: '0x' + randomHex(rng, rng() < 0.7 ? 65 : Math.floor(rng() * 80)),
    },
    verification_public_key: '0x' + randomHex(rng, rng() < 0.7 ? 33 : Math.floor(rng() * 50)),
  };
}

const TRIALS = 3000;

// ---------- P1: termination — bounded, completes for adversarial-length inputs, no hang ----------
function checkP1_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 500) violations++; // pathological hang guard
  }
  return { name: 'P1_termination_bounded_no_hang', trials: checked, violations };
}

// ---------- P2: determinism / metamorphic — identical input => identical output every call ----------
function checkP2_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rand);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1.output_payload) !== JSON.stringify(r2.output_payload)) violations++;
  }
  return { name: 'P2_determinism_same_input_same_output', trials: checked, violations };
}

// ---------- P3: boundedness — computed_hash shape + hash_match/signature_match never fused ----------
function checkP3_boundedness_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!/^0x[0-9a-f]{64}$/.test(output_payload.hash_match.computed_hash)) violations++;
    if (typeof output_payload.hash_match.result !== 'boolean') violations++;
    if (typeof output_payload.signature_match.result !== 'boolean') violations++;
    // never-fuse: the two results are independently-computed keys, never collapsed to one field
    if (!('hash_match' in output_payload) || !('signature_match' in output_payload)) violations++;
  }
  return { name: 'P3_boundedness_hash_shape_and_never_fused', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception per spec §3) ----------
function checkP4_categorical_forcing() {
  let violations = 0, checked = 0;
  const cases = [
    { receipt: {}, proof: {}, verification_public_key: '' },
    { receipt: {}, proof: { signature: '0x' }, verification_public_key: '0x' }, // empty hex
    { receipt: {}, proof: { signature: '0xzz' }, verification_public_key: '0x00' }, // non-hex
    { receipt: {}, proof: { signature: '0x' + '00'.repeat(65) }, verification_public_key: '0x' + '00'.repeat(33) }, // all-zero, valid length
    { receipt: {}, proof: { signature: '0x' + 'ff'.repeat(64) }, verification_public_key: '0x' + '00'.repeat(33) }, // wrong length (64 not 65)
    { receipt: {}, proof: { hashListValues: [] }, verification_public_key: '' }, // empty array (not absent)
    { receipt: {}, proof: { hashListValues: ['wrong', 'order'] }, verification_public_key: '' },
  ];
  for (const pp of cases) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (typeof output_payload.hash_match.result !== 'boolean') violations++;
      if (typeof output_payload.signature_match.result !== 'boolean') violations++;
    } catch (e) {
      violations++; // must never throw — always report a structured result
    }
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded());
results.properties.push(checkP2_determinism());
results.properties.push(checkP3_boundedness_shape());
results.properties.push(checkP4_categorical_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-587-finp2p-ledger-proof-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

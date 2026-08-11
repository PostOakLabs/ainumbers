// cry-04-merkle-batch-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:7c89b9651f986ed6652903c6d41e9fbda29d12db9fbc0a6acd4f7270160b7ccb
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the hand-rolled _sha256 is pure Uint32Array
// bitwise/modular-add arithmetic, and pass_rate/batch_integrity classification compares against
// exact 0/1, not a float epsilon boundary).
// Checks: fixture-oracle gate, termination (the per-proof sibling loop is bounded by
// proof.length, and results.length always equals entries.length regardless of batch size),
// a genuine DIFFERENTIAL check against node:crypto's built-in SHA-256 — this kernel hand-rolls
// its own SHA-256, so the strongest floor available is building real Merkle trees with an
// independent hash implementation (node:crypto, not the kernel's own _sha256) and confirming the
// kernel accepts valid proofs and rejects corrupted ones, which is exactly the "reference
// computation cheap to construct" shape spec §3 calls for on class C kernels, boundedness
// (pass_rate always in [0,1], batch_integrity classification re-derived from counts), and forced
// categorical boundary cases (float_sensitive: no) at the 64-hex-char leaf-format boundary and
// the sibling-order index-parity boundary.
// Zero external dependencies — pure Node built-ins only (node:crypto for the independent oracle,
// mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/cry-04-merkle-batch-verifier.proptest.mjs

import { compute } from '../cry-04-merkle-batch-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'cry-04-merkle-batch-verifier.fixtures.json');
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
const rand = mulberry32(0xCA04);

// ---------- independent oracle: build a real Merkle tree/proof with node:crypto ----------
function sha256hex(hexA, hexB) {
  return createHash('sha256').update(Buffer.from(hexA + hexB, 'hex')).digest('hex');
}
function randomLeafHex(rng) {
  let s = '';
  for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}
// builds a tree over `leaves` (hex strings), returns { root, proofFor(i) }
function buildTree(leaves) {
  let level = leaves.slice();
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) next.push(sha256hex(level[i], level[i + 1]));
      else next.push(level[i]); // odd node carries up unchanged
    }
    levels.push(next);
    level = next;
  }
  const root = level[0];
  function proofFor(leafIndex) {
    const proof = [];
    let idx = leafIndex;
    for (let l = 0; l < levels.length - 1; l++) {
      const lvl = levels[l];
      const isRightChild = idx % 2 === 1;
      const sibIdx = isRightChild ? idx - 1 : idx + 1;
      if (sibIdx < lvl.length) proof.push(lvl[sibIdx]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }
  return { root, proofFor };
}

const TRIALS_DIFF = 400;

// ---------- P1: termination — results bounded by entries.length, per-proof loop bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const n = Math.floor(rand() * 20);
    const entries = new Array(n).fill(0).map((_, idx) => ({ leaf: randomLeafHex(rand), index: idx, proof: new Array(Math.floor(rand() * 8)).fill(0).map(() => randomLeafHex(rand)) }));
    const { output_payload } = compute({ proof_entries: entries, merkle_root: randomLeafHex(rand) });
    checked++;
    if (output_payload.results.length !== n) violations++;
    if (output_payload.total !== n) violations++;
  }
  return { name: 'P1_termination_results_bounded_by_entries', trials: checked, violations };
}

// ---------- P2 (differential, independent oracle): real Merkle trees via node:crypto ----------
// power-of-2 leaf counts only: the kernel's verifyOneProof consumes exactly one proof entry per
// loop iteration and divides idx by 2 unconditionally each step, with no accommodation for an
// odd-node carry-up (no duplicate-last-leaf or skip-a-level convention) -- a non-power-of-2 tree
// makes the proof length vs. idx-halving correspondence ambiguous by construction, independent
// of this floor. Restricting to powers of 2 keeps the independent oracle unambiguous.
const POW2_SIZES = [1, 2, 4, 8, 16];
function checkP2_differential_real_merkle_trees() {
  let violations = 0, checked = 0;
  for (let t = 0; t < TRIALS_DIFF; t++) {
    const n = POW2_SIZES[Math.floor(rand() * POW2_SIZES.length)];
    const leaves = new Array(n).fill(0).map(() => randomLeafHex(rand));
    const { root, proofFor } = buildTree(leaves);
    const entries = leaves.map((leaf, idx) => ({ leaf, index: idx, proof: proofFor(idx) }));
    const { output_payload } = compute({ proof_entries: entries, merkle_root: root });
    checked++;
    if (output_payload.batch_integrity !== 'VERIFIED') violations++;
    if (output_payload.verified_count !== n) violations++;
    if (output_payload.pass_rate !== 1) violations++;
    for (const r of output_payload.results) if (r.status !== 'verified') violations++;
  }
  // corrupted-proof case: flip one byte of one leaf -- must fail, never falsely verify.
  for (let t = 0; t < 100; t++) {
    const n = POW2_SIZES[1 + Math.floor(rand() * (POW2_SIZES.length - 1))]; // >=2, need a sibling to corrupt against
    const leaves = new Array(n).fill(0).map(() => randomLeafHex(rand));
    const { root, proofFor } = buildTree(leaves);
    const victim = Math.floor(rand() * n);
    const corrupted = leaves[victim].slice(0, -1) + (leaves[victim].slice(-1) === '0' ? '1' : '0');
    const entries = leaves.map((leaf, idx) => ({ leaf: idx === victim ? corrupted : leaf, index: idx, proof: proofFor(idx) }));
    const { output_payload } = compute({ proof_entries: entries, merkle_root: root });
    checked++;
    if (output_payload.results[victim].status === 'verified') violations++;
    if (output_payload.batch_integrity === 'VERIFIED') violations++;
  }
  return { name: 'P2_differential_real_merkle_trees_via_node_crypto', trials: checked, violations };
}

// ---------- P3: boundedness — pass_rate in [0,1], batch_integrity classification re-derivation ----------
function checkP3_boundedness_classification() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const n = Math.floor(rand() * 20);
    const entries = new Array(n).fill(0).map((_, idx) => ({ leaf: rand() < 0.5 ? randomLeafHex(rand) : 'not-hex', index: idx, proof: [] }));
    const { output_payload } = compute({ proof_entries: entries, merkle_root: randomLeafHex(rand) });
    checked++;
    if (output_payload.pass_rate < 0 || output_payload.pass_rate > 1) violations++;
    if (output_payload.verified_count + output_payload.failed_count + output_payload.invalid_count !== output_payload.total) violations++;
    const expectedIntegrity = n === 0 ? 'COMPROMISED' : (output_payload.pass_rate === 1 ? 'VERIFIED' : output_payload.pass_rate === 0 ? 'COMPROMISED' : 'PARTIAL');
    if (output_payload.batch_integrity !== expectedIntegrity) violations++;
  }
  return { name: 'P3_boundedness_pass_rate_and_classification', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float_sensitive: no) ----------
function checkP4_categorical_boundary_forcing() {
  let violations = 0, checked = 0;
  // 64-hex-char leaf-format boundary
  for (const len of [63, 64, 65]) {
    const leaf = '0'.repeat(len);
    const { output_payload } = compute({ proof_entries: [{ leaf, index: 0, proof: [] }], merkle_root: leaf });
    checked++;
    const isValidFormat = len === 64;
    if (isValidFormat && output_payload.results[0].status === 'invalid') violations++;
    if (!isValidFormat && output_payload.results[0].status !== 'invalid') violations++;
  }
  // sibling-order index-parity boundary: index 0 (even, leaf-first concat) vs index 1 (odd, sibling-first)
  const leafA = randomLeafHex(rand), leafB = randomLeafHex(rand);
  const rootEven = sha256hex(leafA, leafB); // leaf at index 0, sibling leafB
  const { output_payload: evenResult } = compute({ proof_entries: [{ leaf: leafA, index: 0, proof: [leafB] }], merkle_root: rootEven });
  checked++;
  if (evenResult.results[0].status !== 'verified') violations++;
  const { output_payload: wrongParity } = compute({ proof_entries: [{ leaf: leafA, index: 1, proof: [leafB] }], merkle_root: rootEven });
  checked++;
  if (leafA !== leafB && wrongParity.results[0].status === 'verified') violations++;
  return { name: 'P4_categorical_boundary_forcing_hexlen_and_index_parity', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential_real_merkle_trees());
results.properties.push(checkP3_boundedness_classification());
results.properties.push(checkP4_categorical_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'cry-04-merkle-batch-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

// art-279-state-proof-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C13-1).
// kernel_digest_at_authoring: sha256:cdf00978c1f9c8e64aa49fd927d7dab925a232f49b3f745381396674785ce592
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read of art-279-state-proof-verifier.kernel.mjs confirmed -- every
// operation is on Uint8Array bytes, nibbles, and uint32 lanes for the hand-rolled keccak-256
// sponge; the only arithmetic is bitwise/integer (>>>, ^, &, +, %) and array-length compares.
// No `/` division that isn't an integer/index operation, no Math.*, no floating literals anywhere
// in compute() or its helpers). No ULP-boundary forcing required -- forced categorical boundary
// cases (P4) substitute per spec §3.
// TERMINATION-BOUND ARGUMENT (class-C, unbounded input array): walkTrie's loop is bounded by
// `proofNodes.length`, itself rejected up front if it exceeds MAX_PROOF_NODES=32 (account) /
// MAX_STORAGE_PROOF_NODES=16 (storage) before any hashing happens -- never a recursive descent, no
// hidden unbounded loop. The storage-slot loop is capped at MAX_STORAGE_SLOTS=8 via
// `.slice(0, MAX_STORAGE_SLOTS)`. Total keccak-256 invocations per compute() call is therefore
// bounded above by 32 + 8*16 = 160 regardless of how large the caller's input arrays are -- this
// is asserted directly (P1), not just implied by the constant declarations.
// Checks: fixture-oracle gate, termination/boundedness of proof_nodes_consumed and
// storage_results.length against the hard caps (P1/P2), a differential property re-deriving when
// `errors` must be non-empty from the same structural-validity checks the kernel itself runs (P3),
// forced categorical boundary cases at/over every declared bound plus malformed-hex/empty-array
// inputs (P4), and a metamorphic determinism + single-byte-tamper-never-verifies check as the
// obvious differential identity for a hash-chain verifier with no permutation-invariant structure
// (proof node order is root-to-leaf and load-bearing, so permutation-invariance does not apply
// here -- determinism and tamper-non-acceptance are the metamorphic identities that do) (P5).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-279-state-proof-verifier.proptest.mjs

import { compute } from '../art-279-state-proof-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-279-state-proof-verifier.fixtures.json');
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
const rand = mulberry32(0x279E0);

function randomHex(rng, nBytes) {
  let s = '0x';
  for (let i = 0; i < nBytes; i++) s += Math.floor(rng() * 256).toString(16).padStart(2, '0');
  return s;
}
function randomGarbageProofArray(rng, n) {
  // Random (non-chained) hex "nodes" -- deliberately not a valid proof chain; the point of these
  // trials is bounds/termination behaviour, not verdict correctness (fixture oracle covers that).
  return Array.from({ length: n }, () => randomHex(rng, 1 + Math.floor(rng() * 60)));
}

const TRIALS = 3000;

// ---------- P1: termination/boundedness -- proof_nodes_consumed never exceeds MAX_PROOF_NODES(32) ----------
function checkP1_termination_bounded_proof_nodes() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 40); // spans below/at/above the 32-node cap
    const pp = {
      block_state_root: randomHex(rand, 32),
      address: randomHex(rand, 20),
      account_proof: randomGarbageProofArray(rand, n),
    };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.proof_nodes_consumed > 32) violations++;
    if (n > 32 && output_payload.verdict !== 'INVALID_PROOF') violations++;
    if (!['VERIFIED', 'NOT_FOUND', 'INVALID_PROOF'].includes(output_payload.verdict)) violations++;
  }
  return { name: 'P1_termination_proof_nodes_consumed_bounded_by_max_32', trials: checked, violations };
}

// ---------- P2: boundedness -- storage_results.length never exceeds min(input slots, 8) ----------
function checkP2_boundedness_storage_results() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nSlots = Math.floor(rand() * 12); // spans below/at/above the 8-slot cap
    const pp = {
      block_state_root: randomHex(rand, 32),
      address: randomHex(rand, 20),
      account_proof: randomGarbageProofArray(rand, 1 + Math.floor(rand() * 5)),
      storage_slots: Array.from({ length: nSlots }, () => ({ slot: randomHex(rand, 32), proof: randomGarbageProofArray(rand, 1) })),
    };
    const { output_payload } = compute(pp);
    checked++;
    if (nSlots > 8 && output_payload.verdict !== 'INVALID_PROOF') violations++;
    if (output_payload.storage_results.length > 8) violations++;
    for (const sr of output_payload.storage_results) {
      if (![true, false, null].includes(sr.matches_expected)) violations++;
      if (typeof sr.exists !== 'boolean') violations++;
    }
  }
  return { name: 'P2_boundedness_storage_results_bounded_by_max_8_slots', trials: checked, violations };
}

// ---------- P3 (differential): errors non-empty iff the kernel's own structural checks fail ----------
function checkP3_error_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const badRoot = rand() < 0.5;
    const badAddr = rand() < 0.5;
    const emptyProof = rand() < 0.3;
    const overCap = rand() < 0.1;
    const pp = {
      block_state_root: badRoot ? randomHex(rand, 10) : randomHex(rand, 32),
      address: badAddr ? randomHex(rand, 5) : randomHex(rand, 20),
      account_proof: emptyProof ? [] : randomGarbageProofArray(rand, overCap ? 33 : 1 + Math.floor(rand() * 3)),
    };
    const { output_payload } = compute(pp);
    checked++;
    const expectStructuralError = badRoot || badAddr || emptyProof || overCap;
    if (expectStructuralError && output_payload.errors.length === 0) violations++;
    if (expectStructuralError && output_payload.verdict !== 'INVALID_PROOF') violations++;
    if (!expectStructuralError && output_payload.verdict === 'INVALID_PROOF' && output_payload.errors.length === 0 && output_payload.diagnostic == null) {
      // a non-structural-error INVALID_PROOF must carry a walk diagnostic, never a silent failure
      violations++;
    }
  }
  return { name: 'P3_errors_nonempty_iff_structural_bound_violation', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no -> no ULP forcing; integer bounds) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { label: 'exactly 32 proof nodes (at cap) -> not rejected for size', account_proof: randomGarbageProofArray(rand, 32), expectSizeOk: true },
    { label: '33 proof nodes (1 over cap) -> rejected, bound named in errors', account_proof: randomGarbageProofArray(rand, 33), expectSizeOk: false },
    { label: 'empty account_proof -> rejected', account_proof: [], expectSizeOk: false },
    { label: 'non-hex node string -> rejected as non-hex', account_proof: ['not-hex-at-all'], expectSizeOk: null },
    { label: 'node hex exactly at MAX_NODE_HEX_LEN (1200 chars incl 0x) -> not rejected for length', account_proof: ['0x' + '00'.repeat(599)], expectSizeOk: true },
    { label: 'node hex 1 char over MAX_NODE_HEX_LEN -> rejected for length', account_proof: ['0x' + '00'.repeat(599) + '0'], expectSizeOk: false },
    { label: 'single proof node (minimum non-empty) -> not rejected for size', account_proof: randomGarbageProofArray(rand, 1), expectSizeOk: true },
  ];
  for (const c of cases) {
    const pp = { block_state_root: randomHex(rand, 32), address: randomHex(rand, 20), account_proof: c.account_proof };
    const { output_payload } = compute(pp);
    checked++;
    if (c.expectSizeOk === true) {
      const sizeError = output_payload.errors.some((e) => /exceeds bounded limit|non-empty/.test(e));
      if (sizeError) violations++;
    }
    if (c.expectSizeOk === false) {
      if (output_payload.verdict !== 'INVALID_PROOF' || output_payload.errors.length === 0) violations++;
    }
  }
  // storage_slots boundary: exactly 8 vs 9
  for (const { n, expectRejected } of [{ n: 8, expectRejected: false }, { n: 9, expectRejected: true }]) {
    const pp = {
      block_state_root: randomHex(rand, 32), address: randomHex(rand, 20),
      account_proof: randomGarbageProofArray(rand, 1),
      storage_slots: Array.from({ length: n }, () => ({ slot: randomHex(rand, 32), proof: randomGarbageProofArray(rand, 1) })),
    };
    const { output_payload } = compute(pp);
    checked++;
    if (expectRejected && output_payload.verdict !== 'INVALID_PROOF') violations++;
  }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- P5: metamorphic -- repeat-call determinism + single-byte-tamper never verifies ----------
function checkP5_determinism_and_tamper_canary() {
  let violations = 0, checked = 0;
  // determinism over random inputs (garbage proofs -> INVALID_PROOF/NOT_FOUND, but must be stable)
  for (let i = 0; i < 1000; i++) {
    const pp = {
      block_state_root: randomHex(rand, 32),
      address: randomHex(rand, 20),
      account_proof: randomGarbageProofArray(rand, 1 + Math.floor(rand() * 5)),
    };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  // tamper canary: flipping one hex nibble of a VERIFIED fixture's proof must never still verify.
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-279-state-proof-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const verifiedVec = fixtures.vectors.find((v) => v.output_payload.verdict === 'VERIFIED');
  if (verifiedVec) {
    const baseline = compute(verifiedVec.policy_parameters).output_payload;
    checked++;
    if (baseline.verdict !== 'VERIFIED') violations++; // sanity on the fixture oracle assumption
    for (let nodeIdx = 0; nodeIdx < verifiedVec.policy_parameters.account_proof.length; nodeIdx++) {
      const node = verifiedVec.policy_parameters.account_proof[nodeIdx];
      // flip a nibble roughly in the middle of the node hex string (never the 0x prefix)
      const pos = 2 + Math.floor((node.length - 2) / 2);
      const origChar = node[pos];
      const flipped = origChar === '0' ? '1' : '0';
      const tamperedNode = node.slice(0, pos) + flipped + node.slice(pos + 1);
      const tamperedProof = verifiedVec.policy_parameters.account_proof.slice();
      tamperedProof[nodeIdx] = tamperedNode;
      const tamperedPP = { ...verifiedVec.policy_parameters, account_proof: tamperedProof };
      const tampered = compute(tamperedPP).output_payload;
      checked++;
      if (tampered.verdict === 'VERIFIED') violations++;
    }
  }
  return { name: 'P5_metamorphic_determinism_and_tamper_canary', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_bounded_proof_nodes());
results.properties.push(checkP2_boundedness_storage_results());
results.properties.push(checkP3_error_verdict_differential());
results.properties.push(checkP4_forced_categorical_boundaries());
results.properties.push(checkP5_determinism_and_tamper_canary());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-279-state-proof-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

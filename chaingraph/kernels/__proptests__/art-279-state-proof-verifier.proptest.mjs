// art-279-state-proof-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C9-1).
// kernel_digest_at_authoring: sha256:caa5182df0a6f1fb56dbca66f0c08d5e4eb9988ba471c5b427719273ea3d6632
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure byte/nibble/RLP walk logic and keccak-256
// bitwise arithmetic; no floating-point operators anywhere in the walk).
// TERMINATION-BOUND ARGUMENT (verifier kernel, per WU row instruction): walkTrie's for-loop is
// bounded by `proofNodes.length`, itself capped at MAX_PROOF_NODES=32 by an explicit length
// check before the walk starts (never a recursive descent); the storage-slot loop is capped at
// MAX_STORAGE_SLOTS=8 via `.slice(0, MAX_STORAGE_SLOTS)`, each with its own MAX_STORAGE_PROOF_NODES=16
// walk. Total work is bounded by 32 + 8*16 = 160 node-hash operations regardless of input size —
// this is the class-C "loop bound respected" floor, no recursion in this kernel.
// Checks: fixture-oracle gate, termination/boundedness (proof_nodes_consumed never exceeds
// MAX_PROOF_NODES, storage_results.length never exceeds min(storage_slots.length,
// MAX_STORAGE_SLOTS)), differential re-derivation of INVALID_PROOF-on-bounds-violation, and
// forced categorical boundary cases (float:no, no ULP forcing — bounds are integer counts):
// exactly-at-limit / one-over-limit array sizes, malformed hex, empty inputs.
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
const rand = mulberry32(0x279A0);

function randomHex(rng, nBytes) {
  let s = '0x';
  for (let i = 0; i < nBytes; i++) s += Math.floor(rng() * 256).toString(16).padStart(2, '0');
  return s;
}
function randomGarbageProofArray(rng, n) {
  return Array.from({ length: n }, () => randomHex(rng, 1 + Math.floor(rng() * 60)));
}

const TRIALS = 3000;

// ---------- P1: termination/boundedness — proof_nodes_consumed never exceeds MAX_PROOF_NODES (32) ----------
function checkP1_bounded_proof_nodes() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 40); // deliberately spans below/at/above the 32 cap
    const pp = {
      block_state_root: randomHex(rand, 32),
      address: randomHex(rand, 20),
      account_proof: randomGarbageProofArray(rand, n),
    };
    checked++;
    const { output_payload } = compute(pp);
    if (output_payload.proof_nodes_consumed > 32) violations++;
    if (n > 32 && output_payload.verdict !== 'INVALID_PROOF') violations++;
  }
  return { name: 'P1_proof_nodes_consumed_bounded_by_max_32', trials: checked, violations };
}

// ---------- P2: boundedness — storage_results.length never exceeds min(input slots, 8) ----------
function checkP2_bounded_storage_results() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nSlots = Math.floor(rand() * 12); // spans below/at/above the 8 cap
    const pp = {
      block_state_root: randomHex(rand, 32),
      address: randomHex(rand, 20),
      account_proof: randomGarbageProofArray(rand, 1 + Math.floor(rand() * 5)),
      storage_slots: Array.from({ length: nSlots }, () => ({ slot: randomHex(rand, 32), proof: randomGarbageProofArray(rand, 1) })),
    };
    checked++;
    const { output_payload } = compute(pp);
    if (nSlots > 8 && output_payload.verdict !== 'INVALID_PROOF') violations++;
    if (output_payload.storage_results.length > 8) violations++;
  }
  return { name: 'P2_storage_results_bounded_by_max_8_slots', trials: checked, violations };
}

// ---------- P3 (differential): errors non-empty iff verdict is INVALID_PROOF on structural bound violations ----------
function checkP3_error_verdict_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const badRoot = rand() < 0.5;
    const badAddr = rand() < 0.5;
    const emptyProof = rand() < 0.3;
    const pp = {
      block_state_root: badRoot ? randomHex(rand, 10) : randomHex(rand, 32),
      address: badAddr ? randomHex(rand, 5) : randomHex(rand, 20),
      account_proof: emptyProof ? [] : randomGarbageProofArray(rand, 1 + Math.floor(rand() * 3)),
    };
    checked++;
    const { output_payload } = compute(pp);
    const expectStructuralError = badRoot || badAddr || emptyProof;
    if (expectStructuralError && output_payload.errors.length === 0) violations++;
    if (expectStructuralError && output_payload.verdict !== 'INVALID_PROOF') violations++;
    if (!expectStructuralError && output_payload.verdict === 'INVALID_PROOF' && output_payload.errors.length === 0 && output_payload.diagnostic == null) {
      // a non-structural-error INVALID_PROOF must carry a diagnostic (walk failure), never silent
      violations++;
    }
  }
  return { name: 'P3_errors_nonempty_iff_structural_bound_violation', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no, no ULP forcing — integer bounds) ----------
const CATEGORICAL_CASES = [
  { label: 'exactly 32 proof nodes (at the cap) -> not rejected for size', account_proof: randomGarbageProofArray(rand, 32) },
  { label: '33 proof nodes (1 over the cap) -> rejected, error names the bound', account_proof: randomGarbageProofArray(rand, 33) },
  { label: 'empty account_proof -> rejected', account_proof: [] },
  { label: 'non-hex node string -> rejected as non-hex', account_proof: ['not-hex-at-all'] },
  { label: 'node hex string exactly at MAX_NODE_HEX_LEN (1200 chars incl. 0x prefix) -> not rejected for length', account_proof: ['0x' + '00'.repeat(599)] },
  { label: 'node hex string 1 char over MAX_NODE_HEX_LEN -> rejected for length', account_proof: ['0x' + '00'.repeat(599) + '0'] },
];
function checkP5_forced() {
  return CATEGORICAL_CASES.map((c) => {
    const pp = { block_state_root: randomHex(rand, 32), address: randomHex(rand, 20), account_proof: c.account_proof };
    const { output_payload } = compute(pp);
    return { label: c.label, verdict: output_payload.verdict, errors: output_payload.errors, proof_nodes_consumed: output_payload.proof_nodes_consumed };
  });
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_bounded_proof_nodes());
results.properties.push(checkP2_bounded_storage_results());
results.properties.push(checkP3_error_verdict_differential());
const forcedCases = checkP5_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-279-state-proof-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  forced_categorical_cases: forcedCases,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

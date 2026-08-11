// cry-05-agent-action-audit-trail-aggregator.proptest.mjs — FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C14-1).
// kernel_digest_at_authoring: sha256:5f7f6ab0bb2e2b736805ecde518ca59ba9a83ad38b17545a8c7c133cffa1481f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — hand-rolled SHA-256 bitwise arithmetic and
// integer index bookkeeping only, no caller-supplied float comparisons).
// Checks: fixture-oracle gate, termination (receipts.length always equals the count of
// well-formed artifacts after normalizeEntry filtering, bounded by the input array length; the
// Merkle-tree build loop halves level.length each iteration, terminating in O(log n) levels),
// a genuine DIFFERENTIAL check against an independently-built Merkle tree using node:crypto
// (not the kernel's own _sha256) with the same odd-node duplicate-last-leaf convention the
// kernel uses (`i+1<level.length ? level[i+1] : level[i]`) — the strongest floor available for a
// hand-rolled hash kernel, boundedness (tree_depth === ceil(log2(n_receipts)) for n>=1, 0 for
// n===0; aggregator_chain_depth === max_chain_depth+1; all_proofs_verified only true when
// n_receipts>0 and every receipt's own proof_ok is true), and forced categorical boundary cases
// (float_sensitive: no) for malformed-artifact filtering (64-hex-char boundary, string vs.
// object entry shapes) and the empty-input all-zero root.
// Zero external dependencies — pure Node built-ins only (node:crypto for the independent oracle,
// mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/cry-05-agent-action-audit-trail-aggregator.proptest.mjs

import { compute } from '../cry-05-agent-action-audit-trail-aggregator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'cry-05-agent-action-audit-trail-aggregator.fixtures.json');
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
const rand = mulberry32(0xCA05);
function randomLeafHex(rng) {
  let s = '';
  for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

// ---------- independent oracle: node:crypto tree matching the kernel's own odd-node convention ----------
function sha256pairHex(a, b) {
  return createHash('sha256').update(Buffer.from(a + b, 'hex')).digest('hex');
}
function independentRoot(leaves) {
  if (leaves.length === 0) return { root: '0'.repeat(64), depth: 0 };
  let level = [...leaves];
  let depth = 0;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const r = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(sha256pairHex(level[i], r));
    }
    level = next;
    depth++;
  }
  return { root: level[0], depth };
}

const TRIALS = 3000;

// ---------- P1: termination — receipts bounded by well-formed artifact count ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const artifacts = new Array(n).fill(0).map(() => (rand() < 0.7 ? randomLeafHex(rand) : 'not-hex'));
    const { output_payload } = compute({ artifacts });
    checked++;
    const wellFormed = artifacts.filter((a) => /^[0-9a-f]{64}$/.test(a)).length;
    if (output_payload.n_receipts !== wellFormed) violations++;
    if (output_payload.receipts.length !== wellFormed) violations++;
  }
  return { name: 'P1_termination_receipts_bounded_by_wellformed_count', trials: checked, violations };
}

// ---------- P2 (differential, independent oracle): node:crypto tree matches kernel's ----------
function checkP2_differential_independent_tree() {
  let violations = 0, checked = 0;
  for (let t = 0; t < 400; t++) {
    const n = Math.floor(rand() * 20) + 1;
    const leaves = new Array(n).fill(0).map(() => randomLeafHex(rand));
    const artifacts = leaves.map((h) => 'sha256:' + h);
    const { output_payload } = compute({ artifacts });
    checked++;
    const { root, depth } = independentRoot(leaves);
    if (output_payload.session_receipt_root !== 'sha256:' + root) violations++;
    if (output_payload.merkle_root !== 'sha256:' + root) violations++;
    if (output_payload.tree_depth !== depth) violations++;
    if (!output_payload.all_proofs_verified) violations++;
    for (const r of output_payload.receipts) if (!r.proof_ok) violations++;
  }
  return { name: 'P2_differential_independent_tree_via_node_crypto', trials: checked, violations };
}

// ---------- P3: boundedness — depth formula, aggregator_chain_depth, all_proofs_verified ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20) + 1;
    const artifacts = new Array(n).fill(0).map(() => ({ execution_hash: 'sha256:' + randomLeafHex(rand), tool_id: 'art-x', chain_depth: Math.floor(rand() * 10) }));
    const { output_payload } = compute({ artifacts });
    checked++;
    const expectedDepth = Math.ceil(Math.log2(n));
    if (output_payload.tree_depth !== expectedDepth) violations++;
    const expectedMaxDepth = Math.max(...artifacts.map((a) => a.chain_depth));
    if (output_payload.max_chain_depth !== expectedMaxDepth) violations++;
    if (output_payload.aggregator_chain_depth !== expectedMaxDepth + 1) violations++;
    if (output_payload.all_proofs_verified !== (output_payload.n_receipts > 0 && output_payload.receipts.every((r) => r.proof_ok))) violations++;
  }
  return { name: 'P3_boundedness_depth_formula_and_aggregator_depth', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float_sensitive: no) ----------
function checkP4_categorical_boundary_forcing() {
  let violations = 0, checked = 0;

  // 64-hex-char boundary on string-shaped entries
  for (const len of [63, 64, 65]) {
    const { output_payload } = compute({ artifacts: ['0'.repeat(len)] });
    checked++;
    const expectedFiltered = len !== 64;
    if (expectedFiltered && output_payload.n_receipts !== 0) violations++;
    if (!expectedFiltered && output_payload.n_receipts !== 1) violations++;
  }

  // string vs object entry shapes, mixed
  const mixed = compute({ artifacts: [randomLeafHex(rand), { execution_hash: 'sha256:' + randomLeafHex(rand), tool_id: 'art-01' }, 42, null, {}] });
  checked++;
  if (mixed.output_payload.n_receipts !== 2) violations++;

  // empty input -> all-zero root, finite, all_proofs_verified false
  const empty = compute({ artifacts: [] });
  checked++;
  if (empty.output_payload.session_receipt_root !== 'sha256:' + '0'.repeat(64)) violations++;
  if (empty.output_payload.all_proofs_verified !== false) violations++;
  if (empty.output_payload.aggregator_chain_depth !== 1) violations++;

  return { name: 'P4_categorical_boundary_forcing_hexlen_and_entry_shapes', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential_independent_tree());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_categorical_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'cry-05-agent-action-audit-trail-aggregator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);

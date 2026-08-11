#!/usr/bin/env node
// check-recompute-equality.test.mjs — proven-to-reject controls for the §18 recompute-equality gate.
//
// ⛔ VERIFY BY MUTATION, NOT BY READING THE CODE. Code-reviewing a checker is the same
// self-consistent-checker shape one level up — precisely the failure that produced the defect this gate
// exists to prevent. Every control below FLIPS A BYTE (in the journal, in the kernel source, or in the
// fixture inputs) and asserts the gate goes red; and the canary asserts a hostile kernel is rejected
// rather than executed.
//
// Controls, in order:
//   1. CANARY (phil's non-optional security amendment): a kernel containing require('fs') that tries to
//      write a sentinel file must be REJECTED, and the sentinel must NOT exist afterwards. ⛔ If this
//      passes-and-executes, the gate IS the vulnerability.
//   2. CANARY-2: the same for process / globalThis.process (env exfiltration shape).
//   3. Positive control — a receipt over an EMPTY journal ({}), the exact defect of 2026-08-11.
//   4. Positive control — the un-awaited-async shape (a journal carrying __async).
//   5. MUTATION — flip one byte of journal.output: match must become mismatch.
//   6. MUTATION — flip one byte of the KERNEL SOURCE: match must become mismatch (proves the gate really
//      re-derives from the primary source, rather than reading the claim back out of the artifact).
//   7. MUTATION — flip one byte of the fixture INPUTS: match must become mismatch.
//   8. NEGATIVE control — a single-key output must PASS (⛔ no threshold: 510-… and art-274-… are real
//      single-key nodes and a >=2-key heuristic would false-fail them).
//   9. Evaluator controls — an unquarantined failure fails; a quarantined-but-now-reproducing node fails
//      (the ratchet only goes down); a quarantine entry naming an unexamined node fails.
//
// Zero dependencies. Writes only to os.tmpdir().

import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { recomputeJournalOutput, recomputeInSandbox, jcsEqual } from './recompute-lib.mjs';
import { evaluateResults, isPrivateInputKernel } from './check-recompute-equality.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// A scratch estate: one kernel + one fixtures file + a synthetic node, all under tmpdir.
const TMP = mkdtempSync(join(tmpdir(), 'ocg-recompute-'));
const KDIR = join(TMP, 'kernels');
const FDIR = join(KDIR, 'fixtures');
import { mkdirSync } from 'node:fs';
mkdirSync(FDIR, { recursive: true });

const GOOD_KERNEL = `
export const meta = { tool_id: 'scratch-adder', gpu: false };
export function compute(p) { return { sum: p.a + p.b, doubled: (p.a + p.b) * 2 }; }
export function buildArtifact(p) { return { output_payload: compute(p) }; }
`;
const VECTORS = { vectors: [{ name: 'v0', policy_parameters: { a: 2, b: 3 }, output_payload: { sum: 5, doubled: 10 } }] };

function writeEstate({ kernel = GOOD_KERNEL, vectors = VECTORS } = {}) {
  writeFileSync(join(KDIR, 'scratch-adder.kernel.mjs'), kernel, 'utf8');
  writeFileSync(join(FDIR, 'scratch-adder.fixtures.json'), JSON.stringify(vectors), 'utf8');
}
const nodeWith = (output) => ({ tool_id: 'scratch-adder', compute_proof: { journal: { output } } });
const run = () => recomputeJournalOutput(nodeWith.arguments, { kernelsDir: KDIR, fixturesDir: FDIR });
const check = (output) => recomputeJournalOutput(nodeWith(output), { kernelsDir: KDIR, fixturesDir: FDIR });

writeEstate();

// ── 1. CANARY: require('fs') must be REJECTED, not executed ────────────────────────────────────────
const SENTINEL = join(TMP, 'CANARY-ESCAPED.txt');
await test('CANARY — a kernel containing require(\'fs\') is REJECTED and never reaches the host filesystem', async () => {
  const hostile = `
export function buildArtifact(p) {
  var fs = require('fs');
  fs.writeFileSync(${JSON.stringify(SENTINEL)}, 'the sandbox did not hold');
  return { output_payload: { pwned: true } };
}
`;
  writeEstate({ kernel: hostile });
  const r = await check({ pwned: true });
  assert(r.state !== 'match', `hostile kernel must not produce a match, got ${r.state}`);
  assert(r.state === 'unreproducible', `expected the guest to throw (unreproducible), got ${r.state}: ${r.detail}`);
  assert(!existsSync(SENTINEL), '⛔⛔ THE SANDBOX DID NOT HOLD — the canary wrote to the host filesystem. The gate IS the vulnerability; do not ship it.');
});

await test('CANARY-2 — a kernel reaching for process/env is REJECTED and never reaches the host filesystem', async () => {
  const hostile = `
export function buildArtifact(p) {
  return { output_payload: { env: process.env.PATH, cwd: process.cwd() } };
}
`;
  writeEstate({ kernel: hostile });
  const r = await check({ env: 'x', cwd: 'y' });
  assert(r.state !== 'match', `hostile kernel must not produce a match, got ${r.state}`);
  assert(!existsSync(SENTINEL), 'sandbox escape sentinel exists');
});

// ── 3/4. positive controls: the exact 2026-08-11 defects ────────────────────────────────────────────
writeEstate();
await test('OBSERVED RED — a receipt over an EMPTY journal ({}) does NOT reproduce', async () => {
  const r = await check({});
  assert(r.state === 'mismatch', `expected mismatch for the vacuous receipt, got ${r.state}`);
});

await test('OBSERVED RED — an un-awaited-async journal (carrying __async) does NOT reproduce', async () => {
  const r = await check({ __async: true });
  assert(r.state === 'mismatch', `expected mismatch for the thenable-shaped journal, got ${r.state}`);
});

// ── baseline: the honest receipt reproduces ─────────────────────────────────────────────────────────
await test('GREEN — an honest receipt reproduces from its own kernel', async () => {
  const r = await check({ sum: 5, doubled: 10 });
  assert(r.state === 'match', `expected match, got ${r.state}: ${r.detail}`);
  assert(r.vectorIndex === 0, 'should identify the reproducing vector');
});

await test('GREEN — key ORDER alone is not a mismatch (JCS comparison)', async () => {
  const r = await check({ doubled: 10, sum: 5 });
  assert(r.state === 'match', `key-order-only difference must still match, got ${r.state}`);
});

// ── 5/6/7. MUTATION: flip one byte in each input and confirm every path fails ───────────────────────
await test('MUTATION — one flipped byte in journal.output turns match into mismatch', async () => {
  assert((await check({ sum: 5, doubled: 10 })).state === 'match', 'precondition: unmutated must match');
  const r = await check({ sum: 6, doubled: 10 }); // 5 -> 6
  assert(r.state === 'mismatch', `expected mismatch after mutating the journal, got ${r.state}`);
});

await test('MUTATION — one flipped byte in the KERNEL SOURCE turns match into mismatch (the gate re-derives, it does not read the claim back)', async () => {
  writeEstate({ kernel: GOOD_KERNEL.replace('* 2', '* 3') });
  const r = await check({ sum: 5, doubled: 10 });
  assert(r.state === 'mismatch', `expected mismatch after mutating the kernel, got ${r.state}`);
  writeEstate();
  assert((await check({ sum: 5, doubled: 10 })).state === 'match', 'restoring the kernel must restore the match');
});

await test('MUTATION — one flipped byte in the fixture INPUTS turns match into mismatch', async () => {
  writeEstate({ vectors: { vectors: [{ name: 'v0', policy_parameters: { a: 2, b: 4 }, output_payload: {} }] } });
  const r = await check({ sum: 5, doubled: 10 });
  assert(r.state === 'mismatch', `expected mismatch after mutating the inputs, got ${r.state}`);
  writeEstate();
});

// ── 8. NEGATIVE control: no threshold anywhere ──────────────────────────────────────────────────────
await test('NO THRESHOLD — a legitimate SINGLE-KEY output passes (a >=2-key heuristic would false-fail 510-… and art-274-…)', async () => {
  writeEstate({
    kernel: `export function buildArtifact(p) { return { output_payload: { classification: p.kind } }; }`,
    vectors: { vectors: [{ name: 'v0', policy_parameters: { kind: 'e-money-token' }, output_payload: { classification: 'e-money-token' } }] },
  });
  const r = await check({ classification: 'e-money-token' });
  assert(r.state === 'match', `single-key output must pass, got ${r.state}: ${r.detail}`);
  writeEstate();
});

// ── missing inputs never read as a pass ─────────────────────────────────────────────────────────────
await test('a node with no fixtures reports no-fixtures — it can never read as a pass', async () => {
  const r = await recomputeJournalOutput({ tool_id: 'does-not-exist', compute_proof: { journal: { output: {} } } }, { kernelsDir: KDIR, fixturesDir: FDIR });
  assert(r.state === 'no-kernel', `expected no-kernel, got ${r.state}`);
});

// ── 9. evaluator / ratchet controls ─────────────────────────────────────────────────────────────────
await test('EVALUATOR — an unquarantined non-reproducing receipt FAILS the gate', async () => {
  const v = evaluateResults([{ tool_id: 'x', state: 'mismatch' }], { nodes: [] });
  assert(!v.ok && v.failures.length === 1, 'expected a failure');
});

await test('EVALUATOR — a quarantined receipt that REPRODUCES now FAILS (the ratchet only goes down)', async () => {
  const v = evaluateResults([{ tool_id: 'x', state: 'match' }], { nodes: [{ tool_id: 'x', cause: 'historic' }] });
  assert(!v.ok && v.cured.length === 1, 'a cured node must force its quarantine entry to be deleted');
});

await test('EVALUATOR — a quarantine entry naming an unexamined node FAILS', async () => {
  const v = evaluateResults([{ tool_id: 'x', state: 'match' }], { nodes: [{ tool_id: 'ghost', cause: 'historic' }] });
  assert(!v.ok && v.staleQuarantineEntries.length === 1, 'a stale quarantine entry must be surfaced');
});

await test('EVALUATOR — quarantined and still failing is accepted, named, and counted', async () => {
  const v = evaluateResults([{ tool_id: 'x', state: 'mismatch' }], { nodes: [{ tool_id: 'x', cause: 'historic' }] });
  assert(v.ok && v.excused.length === 1 && v.excused[0].cause === 'historic', 'expected an excused entry carrying its cause');
});

// ── §25 exclusion is a source scan, never an import ─────────────────────────────────────────────────
await test('§25 private-input kernels are detected by static source scan (never imported)', async () => {
  assert(isPrivateInputKernel(`export const meta = { private_input_profile: 'ocg-private-input@1' };`), 'should detect the profile');
  assert(!isPrivateInputKernel(GOOD_KERNEL), 'should not false-positive on an ordinary kernel');
});

// ── the sandbox itself ──────────────────────────────────────────────────────────────────────────────
await test('sandbox executes an honest kernel and returns its output_payload', async () => {
  const out = await recomputeInSandbox(GOOD_KERNEL, { a: 1, b: 1 });
  assert(jcsEqual(out, { sum: 2, doubled: 4 }), 'unexpected sandbox output: ' + JSON.stringify(out));
});

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

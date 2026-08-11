#!/usr/bin/env node
// check-fv-floor-coverage.test.mjs — proven-to-reject fixture for FV-COVERAGE-GATE-1.
//
// Positive controls, run BEFORE this gate was wired into preflight/CI (per the row's own instruction:
// "a gate whose positive control was never observed failing is not known to work — this estate has
// shipped several"). Constructs, in-memory, an un-floored new kernel and a stale-digest floor artifact,
// asserts the gate's pure classifier flags both, then asserts a correctly-authored floor is accepted.
// Uses the REAL canonical sourceDigest() from _buildid.mjs throughout — never a stand-in.

import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyFloor, evaluateCoverage, verifyAuthoringFiles, toolIdFromFloorPath } from './check-fv-floor-coverage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);

const KERNEL_SOURCE = 'export function compute(p){ return { output: p.x + 1 }; }\n';
const TAMPERED_KERNEL_SOURCE = 'export function compute(p){ return { output: p.x + 999 }; }\n';

function floorFileFor(digest) {
  return `// fixture-floor.proptest.mjs\n// kernel_digest_at_authoring: ${digest}\n// (property assertions omitted — fixture only)\n`;
}

// ── positive control 1: brand-new kernel, NO floor file at all — MUST classify missing/red ─────────
await test('OBSERVED RED — a kernel with no __proptests__ file classifies as missing', async () => {
  const r = await classifyFloor(KERNEL_SOURCE, null, sourceDigest);
  assert(r.state === 'missing', `expected missing, got ${r.state}`);
});

// ── positive control 2: floor file present but its digest predates a later kernel edit — MUST be stale/red
await test('OBSERVED RED — a floor file whose recorded digest predates a kernel edit classifies as stale', async () => {
  const authoredDigest = await sourceDigest(KERNEL_SOURCE); // floor authored against the ORIGINAL kernel
  const floorSource = floorFileFor(authoredDigest);
  // kernel source on disk has since been edited — floor never re-verified
  const r = await classifyFloor(TAMPERED_KERNEL_SOURCE, floorSource, sourceDigest);
  assert(r.state === 'stale', `expected stale, got ${r.state}`);
  assert(r.recorded === authoredDigest, 'recorded digest should be the floor file value, unchanged');
  assert(r.current !== authoredDigest, 'recomputed current digest must differ from the (unchanged) floor-file value');
});

// ── positive control 3: floor file present but with NO valid header — presence alone is not enough ──
await test('OBSERVED RED — a floor file with no valid kernel_digest_at_authoring header classifies as missing, not floored', async () => {
  const r = await classifyFloor(KERNEL_SOURCE, '// a proptest file with no digest header at all\n', sourceDigest);
  assert(r.state === 'missing', `expected missing (presence alone must not pass), got ${r.state}`);
});

// ── calibration: a correctly-authored, unmoved floor file MUST pass ─────────────────────────────────
await test('calibration — a floor file whose recorded digest matches the current kernel source classifies as floored', async () => {
  const digest = await sourceDigest(KERNEL_SOURCE);
  const r = await classifyFloor(KERNEL_SOURCE, floorFileFor(digest), sourceDigest);
  assert(r.state === 'floored', `expected floored, got ${r.state}`);
});

// ── CRLF/CR normalization sanity (mirrors check-s18-digest-freshness.test.mjs) ───────────────────────
await test('CRLF/CR line-ending normalization does not produce a false stale', async () => {
  const lf = 'export function compute(p){\n  return { output: p.x };\n}\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const digest = await sourceDigest(lf);
  const r = await classifyFloor(crlf, floorFileFor(digest), sourceDigest);
  assert(r.state === 'floored', `CRLF-vs-LF of identical logical source must NOT read as stale, got ${r.state}`);
});

// ── evaluateCoverage: end-to-end over a small fixture set of live kernels ───────────────────────────
await test('evaluateCoverage separates floored from unfloored over a fixture kernel set', async () => {
  const digestGood = await sourceDigest(KERNEL_SOURCE);
  const liveKernels = [
    { tool_id: 'fx-good', name: 'fx_good' },
    { tool_id: 'fx-missing', name: 'fx_missing' },
    { tool_id: 'fx-stale', name: 'fx_stale' },
  ];
  const kernelSources = { 'fx-good': KERNEL_SOURCE, 'fx-missing': KERNEL_SOURCE, 'fx-stale': TAMPERED_KERNEL_SOURCE };
  const floorSources = { 'fx-good': floorFileFor(digestGood), 'fx-stale': floorFileFor(digestGood) }; // fx-missing has none
  const { unfloored, floored, total } = await evaluateCoverage(
    liveKernels,
    (id) => kernelSources[id],
    (id) => floorSources[id] ?? null,
    sourceDigest,
  );
  assert(total === 3, `expected 3 fixture kernels, got ${total}`);
  assert(floored.length === 1 && floored[0].tool_id === 'fx-good', `expected exactly fx-good floored, got ${JSON.stringify(floored.map((r) => r.tool_id))}`);
  assert(unfloored.length === 2, `expected 2 unfloored (fx-missing, fx-stale), got ${unfloored.length}`);
  assert(unfloored.some((r) => r.tool_id === 'fx-missing' && r.state === 'missing'), 'fx-missing should be state missing');
  assert(unfloored.some((r) => r.tool_id === 'fx-stale' && r.state === 'stale'), 'fx-stale should be state stale');
});

// ── FV-FLOOR-DIGEST-GATE-1: --verify-authoring, scoped to the PR's own diff ─────────────────────────
// These tests exercise verifyAuthoringFiles() directly — the pure function the CLI's --verify-authoring
// branch calls — via injected in-memory readers, never touching disk, mirroring the injection shape of
// classifyFloor/evaluateCoverage above.

await test('toolIdFromFloorPath extracts the tool_id from a *.proptest.mjs path (either slash style)', () => {
  assert(toolIdFromFloorPath('chaingraph/kernels/__proptests__/art-999-fake.proptest.mjs') === 'art-999-fake');
  assert(toolIdFromFloorPath('chaingraph\\kernels\\__proptests__\\art-999-fake.proptest.mjs') === 'art-999-fake', 'must handle backslash paths from a Windows git-diff listing');
  assert(toolIdFromFloorPath('chaingraph/kernels/_buildid.mjs') === null, 'a non-floor-file path must not yield a tool_id');
});

function fakeIO({ floorFiles, kernelFiles }) {
  return {
    floorExists: (p) => Object.prototype.hasOwnProperty.call(floorFiles, p),
    kernelExists: (id) => Object.prototype.hasOwnProperty.call(kernelFiles, id),
    readFloorSource: (p) => floorFiles[p],
    readKernelSource: (id) => kernelFiles[id],
    sourceDigestFn: sourceDigest,
  };
}

await test('OBSERVED RED — verifyAuthoringFiles FAILS a floor file whose header digest is fabricated (does not match the real kernel it floors, in the SAME diff)', async () => {
  const goodDigest = await sourceDigest(KERNEL_SOURCE);
  const fabricated = 'sha256:' + 'deadbeef'.repeat(8);
  const io = fakeIO({
    floorFiles: { 'chaingraph/kernels/__proptests__/fx-good.proptest.mjs': floorFileFor(fabricated) },
    kernelFiles: { 'fx-good': KERNEL_SOURCE },
  });
  const results = await verifyAuthoringFiles(['chaingraph/kernels/__proptests__/fx-good.proptest.mjs'], io);
  assert(results.length === 1, `expected 1 result, got ${results.length}`);
  assert(results[0].verdict === 'fail', `expected fail, got ${results[0].verdict}`);
  assert(results[0].recorded === fabricated, 'recorded value should be the fabricated header, unchanged');
  assert(results[0].current === goodDigest, 'current should be the real sourceDigest() of the kernel');
});

await test('calibration — verifyAuthoringFiles PASSES a floor file whose header digest is the executed sourceDigest() of the kernel it floors', async () => {
  const goodDigest = await sourceDigest(KERNEL_SOURCE);
  const io = fakeIO({
    floorFiles: { 'chaingraph/kernels/__proptests__/fx-good.proptest.mjs': floorFileFor(goodDigest) },
    kernelFiles: { 'fx-good': KERNEL_SOURCE },
  });
  const results = await verifyAuthoringFiles(['chaingraph/kernels/__proptests__/fx-good.proptest.mjs'], io);
  assert(results.length === 1 && results[0].verdict === 'pass', `expected pass, got ${JSON.stringify(results)}`);
});

await test('verifyAuthoringFiles SKIPS a non-floor-file path and a deleted-in-diff floor file, never counting either as a failure', async () => {
  const io = fakeIO({
    floorFiles: {}, // nothing exists on disk — simulates a file deleted later in the same diff
    kernelFiles: { 'fx-good': KERNEL_SOURCE },
  });
  const results = await verifyAuthoringFiles(
    ['chaingraph/kernels/_buildid.mjs', 'chaingraph/kernels/__proptests__/fx-deleted.proptest.mjs'],
    io,
  );
  assert(results.every((r) => r.verdict === 'skip'), `expected both skipped, got ${JSON.stringify(results.map((r) => r.verdict))}`);
});

await test('verifyAuthoringFiles FAILS (not skips) a floor file whose kernel does not exist — cannot verify against a missing kernel', async () => {
  const io = fakeIO({
    floorFiles: { 'chaingraph/kernels/__proptests__/fx-orphan.proptest.mjs': floorFileFor(await sourceDigest(KERNEL_SOURCE)) },
    kernelFiles: {}, // kernel absent
  });
  const results = await verifyAuthoringFiles(['chaingraph/kernels/__proptests__/fx-orphan.proptest.mjs'], io);
  assert(results.length === 1 && results[0].verdict === 'fail', `expected fail, got ${JSON.stringify(results)}`);
});

await test('SCOPE PROOF — verifyAuthoringFiles is a no-op given zero paths, never a vacuous full-estate check', async () => {
  const results = await verifyAuthoringFiles([], fakeIO({ floorFiles: {}, kernelFiles: {} }));
  assert(results.length === 0, `expected 0 results for 0 given paths, got ${results.length}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

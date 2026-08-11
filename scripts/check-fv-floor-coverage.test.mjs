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
import { classifyFloor, evaluateCoverage } from './check-fv-floor-coverage.mjs';

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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

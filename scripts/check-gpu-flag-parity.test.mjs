#!/usr/bin/env node
/**
 * check-gpu-flag-parity.test.mjs — fixture proof for GPU-FLAG-PARITY-GATE-1.
 *
 * A gate never seen red is not a gate (SO #34c / GATE-SELFTEST-META-1). This
 * file proves check-gpu-flag-parity.mjs CAN go red and WHY it stays quiet, by
 * mutation, against in-memory entries plus a real temp-dir scan:
 *
 *   1. RED   — the exact historical contradiction (kernel meta.gpu=false vs
 *              shard gpu=true, the art-124 shape) is detected and named.
 *   2. RED   — the opposite direction (kernel true vs shard false) too.
 *   3. GREEN — equal booleans (both true, both false) are clean.
 *   4. SKIP  — kernel meta.gpu UNDECLARED is out of scope (235/663 kernels
 *              predate the field; flagging them would be a false red).
 *   5. SKIP  — shard without a `gpu` member is out of scope.
 *   6. SKIP  — a live node with no kernel file is check-kernel-coverage's
 *              gap, never double-reported here.
 *   7. SCAN  — scanLiveShards() over a real temp directory skips non-live
 *              shards and kernel-less nodes, and only live nodes with kernel
 *              files reach the matcher.
 *   8. LIVE  — the real tree on this branch is GREEN (art-124 fixed in this
 *              same PR), i.e. the gate's own GATES entry and this control agree.
 *
 * Usage: node scripts/check-gpu-flag-parity.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMismatches, scanLiveShards } from './check-gpu-flag-parity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log(`✓ ${msg}`); }
  else { failures++; console.log(`✗ ${msg}`); }
}
function named(entries, tool_id) { return entries.find((e) => e.tool_id === tool_id); }

// ── 1–6: the matcher against in-memory entries ──────────────────────────────────
const entries = [
  { tool_id: 'art-x-contradiction-kernel-false', shardPath: 's1.json', gpu: true, kernelGpu: false, hasKernelFile: true },
  { tool_id: 'art-x-contradiction-kernel-true', shardPath: 's2.json', gpu: false, kernelGpu: true, hasKernelFile: true },
  { tool_id: 'art-x-equal-true', shardPath: 's3.json', gpu: true, kernelGpu: true, hasKernelFile: true },
  { tool_id: 'art-x-equal-false', shardPath: 's4.json', gpu: false, kernelGpu: false, hasKernelFile: true },
  { tool_id: 'art-x-meta-undeclared', shardPath: 's5.json', gpu: true, kernelGpu: undefined, hasKernelFile: true },
  { tool_id: 'art-x-shard-undeclared', shardPath: 's6.json', gpu: undefined, kernelGpu: false, hasKernelFile: true },
  { tool_id: 'art-x-no-kernel-file', shardPath: 's7.json', gpu: true, kernelGpu: false, hasKernelFile: false },
];
const red = findMismatches(entries);

assert(red.length === 2, `exactly the 2 contradictions are reported (got ${red.length})`);
assert(!!named(red, 'art-x-contradiction-kernel-false') && named(red, 'art-x-contradiction-kernel-false').kernelGpu === false && named(red, 'art-x-contradiction-kernel-false').gpu === true,
  'RED: kernel meta.gpu=false vs shard gpu=true (the historical art-124 shape) is detected with both values named');
assert(!!named(red, 'art-x-contradiction-kernel-true'), 'RED: kernel meta.gpu=true vs shard gpu=false is detected too');
assert(!named(red, 'art-x-equal-true') && !named(red, 'art-x-equal-false'), 'GREEN: equal booleans read clean in both directions');
assert(!named(red, 'art-x-meta-undeclared'), 'SKIP: undeclared kernel meta.gpu is out of scope (no false red on legacy kernels)');
assert(!named(red, 'art-x-shard-undeclared'), 'SKIP: shard without a gpu member is out of scope');
assert(!named(red, 'art-x-no-kernel-file'), 'SKIP: kernel-less live node is not double-reported here');

// ── 7: the scanner against a real temp tree ─────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'gpu-parity-test-'));
try {
  const nodesDir = join(tmp, 'nodes');
  const kernelsDir = join(tmp, 'kernels');
  mkdirSync(nodesDir); mkdirSync(kernelsDir);
  writeFileSync(join(nodesDir, 'live-with-kernel.json'), JSON.stringify({ tool_id: 'live-with-kernel', status: 'live', gpu: true }));
  writeFileSync(join(nodesDir, 'live-no-kernel.json'), JSON.stringify({ tool_id: 'live-no-kernel', status: 'live', gpu: true }));
  writeFileSync(join(nodesDir, 'draft-with-kernel.json'), JSON.stringify({ tool_id: 'draft-with-kernel', status: 'draft', gpu: true }));
  writeFileSync(join(nodesDir, 'not-json.json'), '{ this is not json');
  writeFileSync(join(kernelsDir, 'live-with-kernel.kernel.mjs'), 'export const meta = { gpu: true };\nexport async function compute() { return {}; }\n');

  const scanned = scanLiveShards(nodesDir, kernelsDir);
  assert(scanned.length === 2, `scanner returns only live shards (got ${scanned.length})`);
  assert(!!named(scanned, 'live-with-kernel') && named(scanned, 'live-with-kernel').hasKernelFile === true, 'scanner marks the node WITH a kernel file as in-scope');
  assert(!!named(scanned, 'live-no-kernel') && named(scanned, 'live-no-kernel').hasKernelFile === false, 'scanner marks the kernel-less live node hasKernelFile=false (matcher then skips it)');
  assert(!named(scanned, 'draft-with-kernel'), 'scanner skips non-live (draft) shards');
  assert(named(scanned, 'live-with-kernel').gpu === true, 'scanner carries the shard gpu value through');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── 8: live-tree control — the gate's own GATES entry must agree with this test ──
try {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, [resolve(HERE, 'check-gpu-flag-parity.mjs')], { encoding: 'utf8' });
  assert(/GPU flag parity clean/.test(out), 'LIVE TREE: the real gate run prints its clean line on this branch (art-124 fixed in this PR)');
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  failures++;
  console.log(`✗ LIVE TREE: the real gate run is RED on this branch — it must be green after this PR's art-124 fix. Output:\n${out.slice(0, 800)}`);
}

if (failures > 0) {
  console.error(`\n✗ ${failures} fixture assertion(s) failed.`);
  process.exit(1);
}
console.log('\n✓ all check-gpu-flag-parity fixture assertions passed.');

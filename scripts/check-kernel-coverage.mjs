// check-kernel-coverage.mjs — every gpu:false LIVE chaingraph node MUST have a kernel registered
// in chaingraph/kernels/index.mjs.
//
// WHY: the worker CI's kernel-coverage.mjs gate (post-deploy "Validate MCP server") fails if a
// gpu:false node exists in chaingraph.json but its kernel isn't in index.mjs — which happens when a
// wave adds nodes + kernel FILES but forgets the index.mjs import/registration. That's a wasted
// CI cycle (red after push). This is the SITE-side mirror so the gap is caught in `preflight.mjs`
// BEFORE push — restoring the "green preflight ⇒ green CI" promise for this gate too.
// (Wave 26 / NIS2 hit this: 174 nodes, 168 kernels — art-141…146 unregistered.)

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainContext } from './derived-artifacts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CG = resolve(HERE, '..', 'chaingraph');

// Registered kernel tool_ids = keys of the KERNELS map in index.mjs (text-parse — decoupled from
// kernel execution, exactly like the worker gate; syntax-check.mjs separately validates the files).
const idx = readFileSync(resolve(CG, 'kernels', 'index.mjs'), 'utf8');
const block = idx.slice(idx.indexOf('KERNELS = {'));
const registered = new Set([...block.matchAll(/['"]([a-z0-9][a-z0-9._-]+)['"]\s*:/gi)].map((m) => m[1]));

const cg = JSON.parse(readFileSync(resolve(CG, 'chaingraph.json'), 'utf8'));
const live = (cg.nodes ?? []).filter((n) => n.status === 'live');
const gpuFalse = live.filter((n) => n.gpu === false);
const unported = gpuFalse.filter((n) => !registered.has(n.tool_id)).map((n) => n.tool_id);

if (unported.length) {
  console.error(`✗ kernel-coverage FAILED — ${unported.length} gpu:false live node(s) have NO kernel registered in chaingraph/kernels/index.mjs:`);
  for (const t of unported) console.error('  • ' + t);
  console.error("\nFor each: add `import * as X from './<tool_id>.kernel.mjs';` AND a `'<tool_id>': X,` entry to the KERNELS map in index.mjs.");
  console.error('(CONTRACT §A4. Mirrors the worker post-deploy kernel-coverage gate — caught here BEFORE push instead of as red CI after deploy.)');
  // chaingraph/kernels/index.mjs is a SHARED DERIVED artifact with a single writer: main (SO #35).
  // A PR that adds kernels therefore CANNOT register them here — the regen bot does, after merge.
  // So this gate is by-construction red pre-merge, exactly like the derived-freshness gates:
  // advisory on pull_request AND merge_group, hard only on push:main. Third instance of this class
  // in one row — see also check-guest-builtin-safety.mjs and vm-parity-gate.mjs --only fallbacks.
  if (!isMainContext()) {
    console.error('::warning title=Advisory: kernel-coverage::index.mjs is single-writer on main (SO #35); the regen bot registers these after merge.');
    process.exit(0);
  }
  process.exit(1);
}
console.log(`✓ kernel-coverage clean — all ${gpuFalse.length} gpu:false live nodes registered in index.mjs (${registered.size} kernels).`);

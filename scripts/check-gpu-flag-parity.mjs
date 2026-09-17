#!/usr/bin/env node
/**
 * check-gpu-flag-parity.mjs — GPU-FLAG-PARITY-GATE-1
 *
 * For every LIVE node shard under chaingraph/graph/nodes/ that has a kernel file,
 * the kernel's `meta.gpu` and the shard's `gpu` flag must AGREE. A contradiction
 * (both declared, values different) is a hard failure naming each offending node.
 *
 * WHY: nothing gated this pair. Measured 2026-09-17 across all 661 live nodes
 * (ART124-OPTIONS-REPORT.md incidental finding 1): art-124 was the ONLY live node
 * whose kernel meta.gpu (false) contradicted its shard gpu (true) — the kernel had
 * been written sync/deterministic (meta.gpu: false) while the shard still claimed
 * gpu: true, so every gpu:false downstream reader (s18 digest-freshness scope,
 * §18 coverage scoping, prove-class statements) disagreed with the registry about
 * which execution class the node belongs to. The ART124-POLICY-CORE-PROVE-1 row
 * fixes that one contradiction in the same PR that lands this gate, so the gate
 * is born green with baseline 0 (no ratchet file — the predicate is a pure
 * equality check over declared values, not a count to shield).
 *
 * SCOPE (deliberate, matches the measured finding):
 *   - Only nodes with status "live" are checked (non-live shards are inert).
 *   - Only CONTRADICTIONS are reported: kernel meta.gpu undefined (235 of 663
 *     kernels predate the field) and shards without a `gpu` member are out of
 *     scope here — metadata completeness is check-kernel-exports /
 *     schema-validate territory, not parity.
 *   - A live node with no kernel file is out of scope: check-kernel-coverage
 *     already owns that gap and this gate must not double-report it.
 *
 * Usage:
 *   node scripts/check-gpu-flag-parity.mjs           — check (exit 1 naming mismatches)
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');

/**
 * Pure matcher, exported for the paired self-test (GATE-SELFTEST-META-1):
 * given scanned entries, return the contradiction list. An entry is
 *   { tool_id, shardPath, gpu, kernelGpu, hasKernelFile }
 * where `gpu` / `kernelGpu` are the declared values (boolean) or undefined,
 * and `hasKernelFile` is false when chaingraph/kernels/<tool_id>.kernel.mjs
 * is absent on disk. Only (both declared AND different) is a contradiction;
 * a missing kernel file or an undeclared side is out of scope by design.
 */
export function findMismatches(entries) {
  const out = [];
  for (const e of entries) {
    if (!e.hasKernelFile) continue;
    if (typeof e.gpu !== 'boolean' || typeof e.kernelGpu !== 'boolean') continue;
    if (e.gpu !== e.kernelGpu) out.push(e);
  }
  return out;
}

/**
 * Scan the live shard tree. Exported so the self-test can prove the scan's
 * filtering (non-live skipped, kernel-less skipped) against a real directory
 * without importing 660 kernel modules.
 */
export function scanLiveShards(nodesDir = NODES_DIR, kernelsDir = KERNELS_DIR, readJson = null) {
  const read = readJson ?? ((p) => JSON.parse(readFileSync(p, 'utf8')));
  const entries = [];
  for (const f of readdirSync(nodesDir).filter((n) => n.endsWith('.json'))) {
    const shardPath = resolve(nodesDir, f);
    let shard;
    try {
      shard = read(shardPath);
    } catch {
      continue; // unparseable shard — schema-validate owns that failure
    }
    if (shard?.status !== 'live') continue;
    const kernelPath = resolve(kernelsDir, `${shard.tool_id}.kernel.mjs`);
    entries.push({
      tool_id: shard.tool_id,
      shardPath,
      gpu: shard.gpu,
      hasKernelFile: existsSync(kernelPath),
      kernelPath,
    });
  }
  return entries;
}

async function main() {
  const entries = scanLiveShards();
  // Import each in-scope kernel that exists (the check-kernel-exports.mjs
  // technique — import the module, read its exported meta; never regex the source).
  for (const e of entries) {
    if (!e.hasKernelFile) continue;
    const m = await import(pathToFileURL(e.kernelPath).href);
    e.kernelGpu = m?.meta?.gpu;
  }
  const mismatches = findMismatches(entries);
  if (mismatches.length > 0) {
    console.error(`✗ GPU flag parity FAILED — ${mismatches.length} live node(s) contradict their kernel meta.gpu:`);
    for (const e of mismatches) {
      console.error(`  • ${e.tool_id}: kernel meta.gpu=${e.kernelGpu} vs shard gpu=${e.gpu}`);
      console.error(`      shard : ${e.shardPath}`);
      console.error(`      kernel: ${e.kernelPath}`);
    }
    console.error('  Fix the flags in the owning row\'s diff — never hand-flip another node\'s gpu flag to quiet this gate.');
    process.exit(1);
  }
  console.log(`✓ GPU flag parity clean — kernel meta.gpu == shard gpu for all ${entries.length} live node(s) with kernel files.`);
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) main();

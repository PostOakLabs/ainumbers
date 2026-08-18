#!/usr/bin/env node
// scripts/gen-registry-kernel-resolve.mjs — REGISTRY-RESOLVE-STATIC-1.
//
// Positive-half-only kernel_digest -> spec_digest resolution, per
// research/REGISTRY-TILES-DESIGN-1.md §3.2 + §4 + §5.1 (the design — not
// redesigned here). Writes one plain, content-addressed record per in-scope
// kernel to registry/kernel/<hex kernel_digest>.json.
//
// WHY THIS IS SAFE WITHOUT ANY PROOF MACHINERY (§3.2): the file is keyed by
// the hash of the thing it describes. A consumer who already holds
// kernel_digest can hash the kernel bytes themselves and compare — a wrong
// answer is detectable with no signature, root, checkpoint or proof. A 404 is
// NOT evidence of anything (a deploy gap, a CDN miss, a typo are
// indistinguishable from "never registered") — this generator/gate makes no
// absence claim anywhere, and nothing it writes may be read as one.
//
// INDEPENDENT DERIVATION (SO #34): kernel_digest and spec_digest are BOTH
// recomputed here from the kernel source bytes and chaingraph/standard/SPEC.md
// bytes respectively, on every run. Neither is ever read from a field an
// earlier process wrote (e.g. an existing compute_images sha256-source entry
// is never consulted).
//
// CANONICALIZATION: record bytes are produced through the shared cgCanon()
// path in chaingraph/kernels/_hash.mjs — the one correct canonicalization in
// this estate. This is NOT an execution_hash preimage (there is no
// policy_parameters/output_payload pair here); cgCanon is reused only for its
// key-sort + minimal-whitespace JSON shape, so every generator in the estate
// keeps producing byte-identical records for byte-identical inputs.
//
// SCOPE (mirrors chaingraph/kernels/gen-kernel-identity.mjs's population):
// status "live", gpu:false, kernel registered in chaingraph/kernels/index.mjs,
// and a .kernel.mjs file present on disk.
//
// NOT IN THIS ROW: no absence proofs, no Merkle/ICS23 tree, no log, no head,
// no Sigsum anchor, no append-only semantics, no cache-header change. See the
// row's fence.
//
// Usage:
//   node scripts/gen-registry-kernel-resolve.mjs --write
//   node scripts/gen-registry-kernel-resolve.mjs --check

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from '../chaingraph/kernels/_buildid.mjs';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const CGPATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const SPEC_PATH = resolve(REPO, 'chaingraph', 'standard', 'SPEC.md');
const OUT_DIR = resolve(REPO, 'registry', 'kernel');

// design note §5.1, carried verbatim (not a paraphrase) into every record's note field.
export const NEVER_LIVE_DEPENDENCY_NOTE =
  'This file and its Sigsum anchor inform *trust* in a spec version, not the *validity* of any composed FV+zk artifact. A receipt issued against a spec digest verifies cryptographically offline, in full, whether or not this feed is ever fetched, whether or not it is reachable, and regardless of its content. Checking this feed is optional due diligence by the reader, never a verification step.';

const mode = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check' : null;
if (!mode) { console.error('usage: gen-registry-kernel-resolve.mjs --write | --check'); process.exit(2); }

const idxSrc = readFileSync(resolve(KDIR, 'index.mjs'), 'utf8');
const kBlock = idxSrc.slice(idxSrc.indexOf('KERNELS = {'));
const registeredIds = new Set([...kBlock.matchAll(/['"]([a-z0-9][a-z0-9._-]+)['"]\s*:/gi)].map((m) => m[1]));

const cg = JSON.parse(readFileSync(CGPATH, 'utf8'));
if (!cg.spec_version) { console.error('✗ chaingraph.json has no spec_version'); process.exit(3); }
const specVersion = cg.spec_version;

const inScope = (cg.nodes ?? []).filter(
  (n) => n.status === 'live' && n.gpu === false && registeredIds.has(n.tool_id)
    && existsSync(resolve(KDIR, n.tool_id + '.kernel.mjs')),
);
if (inScope.length === 0) { console.error('✗ 0 in-scope kernels found — refusing to treat that as a valid empty regen (SO #34c: absence is not a pass)'); process.exit(3); }

export function canonicalRecordBytes(record) {
  return JSON.stringify(cgCanon(record));
}

async function buildRecords() {
  const specDigest = await sourceDigest(readFileSync(SPEC_PATH, 'utf8'));
  const byFile = new Map(); // filename -> { record, tool_ids: [] }
  for (const n of inScope) {
    const src = readFileSync(resolve(KDIR, n.tool_id + '.kernel.mjs'), 'utf8');
    const kernelDigest = await sourceDigest(src); // sha256:<hex>, independently recomputed
    const hex = kernelDigest.slice('sha256:'.length);
    const record = {
      kernel_digest: kernelDigest,
      spec_version: specVersion,
      spec_digest: specDigest,
      note: NEVER_LIVE_DEPENDENCY_NOTE,
    };
    const fname = `${hex}.json`;
    const existing = byFile.get(fname);
    if (existing) {
      // Two registered kernels sharing byte-identical source hash to the same
      // spec/spec_digest produce the same record by construction — fine, same file.
      if (canonicalRecordBytes(existing.record) !== canonicalRecordBytes(record)) {
        throw new Error(`kernel_digest collision with differing record content: ${n.tool_id} vs ${existing.tool_ids.join(',')} both map to ${fname}`);
      }
      existing.tool_ids.push(n.tool_id);
    } else {
      byFile.set(fname, { record, tool_ids: [n.tool_id] });
    }
  }
  return byFile;
}

const byFile = await buildRecords();

if (mode === 'check') {
  const problems = [];
  if (!existsSync(OUT_DIR)) {
    console.error(`✗ REGISTRY-RESOLVE-STATIC-1 FAILED — ${OUT_DIR} does not exist. Run: node scripts/gen-registry-kernel-resolve.mjs --write`);
    process.exit(1);
  }
  const onDisk = new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')));
  const wanted = new Set(byFile.keys());
  for (const fname of wanted) {
    if (!onDisk.has(fname)) { problems.push(`missing ${fname}`); continue; }
    const actual = readFileSync(resolve(OUT_DIR, fname), 'utf8');
    const want = canonicalRecordBytes(byFile.get(fname).record);
    if (actual !== want) problems.push(`stale ${fname} (on-disk content does not match recomputed record)`);
  }
  for (const fname of onDisk) {
    if (!wanted.has(fname)) problems.push(`orphan ${fname} (no longer produced by any in-scope kernel — SO #34c: a leftover file is not evidence of anything, it is a bug)`);
  }
  if (problems.length) {
    console.error(`✗ REGISTRY-RESOLVE-STATIC-1 kernel-resolve coverage FAILED — ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 25)) console.error('  • ' + p);
    if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
    console.error('\nRun: node scripts/gen-registry-kernel-resolve.mjs --write');
    process.exit(1);
  }
  console.log(`✓ REGISTRY-RESOLVE-STATIC-1 clean — ${wanted.size} record(s) for ${inScope.length} in-scope kernel(s), all current.`);
  process.exit(0);
}

// --- WRITE -------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
let written = 0, unchanged = 0;
for (const [fname, { record }] of byFile) {
  const path = resolve(OUT_DIR, fname);
  const want = canonicalRecordBytes(record);
  if (existsSync(path) && readFileSync(path, 'utf8') === want) { unchanged++; continue; }
  writeFileSync(path, want);
  written++;
}
console.log(`✓ REGISTRY-RESOLVE-STATIC-1 wrote ${written} record(s), ${unchanged} already current, for ${inScope.length} in-scope kernel(s) (${byFile.size} unique file(s)). Run --check to verify. (Orphan files, if any, are never deleted by this generator — --check reports them.)`);

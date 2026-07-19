// gen-kernel-identity.mjs — §17 Kernel Identity Binding, suite-wide adoption (OCG SPEC.md §17).
//
// Publishes, per gpu:false LIVE node with a registered kernel, a Graph Index identity:
//   node.compute_images[] += { system:"sha256-source", image_id:"sha256:<digest>", valid_from }
// where <digest> = sourceDigest() of the deployed kernel file (LF-normalized SHA-256, _buildid.mjs).
//
// This is the published leg of the §17.1 three-way cross-check
//   artifact.audit_signature.build_identity.kernel_digest == compute_images[sha256-source].image_id
//     == recomputed digest of the deployed source.
// The Worker attaches build_identity from this published entry at server-compute time (advisory: which
// SOURCE ran — NOT a proof of execution, that is §18). Hash-excluded; no execution_hash / version change.
//
// Conformance-by-construction: --write stamps the digests, --check (preflight + CI) FAILS if any in-scope
// node is missing the sha256-source entry or its digest disagrees with the deployed kernel source.
//
// Surgical TEXT upsert (chaingraph.json is NOT canonical JSON.stringify — full reserialize would churn
// ~11k compact lines): per node, replace an existing `"compute_images":` line or insert one after the
// node's `"compute_capability":` line. Existing non-sha256-source entries (e.g. risc0 §18 ImageIDs) are
// preserved; any stale sha256-source entry is replaced.
//
// --- SHARD MODE (CGSHARD, KERNELID-SHARD-1) ---------------------------------------------------------
// chaingraph.json is itself an ASSEMBLED artifact (scripts/assemble-chaingraph.mjs) built from per-node
// shard files at chaingraph/graph/nodes/<tool_id>.json — the shard, not the monolith, is a kernel-editing
// WU's actual disjoint fence file (Standing Order #6). Pass --shard to operate on shard files DIRECTLY
// instead of chaingraph.json:
//   --write --shard              stamp every in-scope node that has a shard file, writing ONLY that shard
//   --write --shard=<tool_id>    stamp just one shard (the common case: a single edited kernel)
//   --check --shard[=<tool_id>]  same coverage check, read directly off the shard(s)
// Shard mode never opens chaingraph.json (read OR write) — it discovers/filters nodes from the shard
// files themselves, so a kernel-identity regen for a sharded node cannot touch the locked monolith. After
// a batch of shard edits lands, the ORCH's ASSEMBLE+LAND step (scripts/assemble-chaingraph.mjs) folds the
// updated shards into chaingraph.json as usual — this tool does not change that step.
// A node with no shard file is out of scope for --shard (skipped, reported) and must still go through
// plain --write, which is unchanged and remains the assembler-side / full-coverage path.
//
// Run:  node chaingraph/kernels/gen-kernel-identity.mjs --write
//       node chaingraph/kernels/gen-kernel-identity.mjs --check
//       node chaingraph/kernels/gen-kernel-identity.mjs --write --shard=508-repo-haircut-collateral-calculator

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from './_buildid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KDIR = HERE;
const CGPATH = resolve(HERE, '..', 'chaingraph.json');
const NODES_DIR = resolve(HERE, '..', 'graph', 'nodes');
const VALID_FROM = '2026-07-10';

const mode = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check' : null;
if (!mode) { console.error('usage: gen-kernel-identity.mjs --write | --check [--shard[=<tool_id>]]'); process.exit(2); }

const shardFlag = process.argv.find((a) => a === '--shard' || a.startsWith('--shard='));
const shardMode = !!shardFlag;
const shardOnlyId = shardFlag && shardFlag.includes('=') ? shardFlag.slice('--shard='.length) : null;

// Registered kernel tool_ids = keys of the KERNELS map in index.mjs (text-parse, same as the worker /
// coverage gates — decoupled from kernel execution). Needed by both modes; independent of
// chaingraph.json/shards, so computed once up front.
const idxSrc = readFileSync(resolve(KDIR, 'index.mjs'), 'utf8');
const kBlock = idxSrc.slice(idxSrc.indexOf('KERNELS = {'));
const registeredIds = new Set([...kBlock.matchAll(/['"]([a-z0-9][a-z0-9._-]+)['"]\s*:/gi)].map((m) => m[1]));

// Upsert (or leave, reporting) a sha256-source compute_images entry inside a single node's raw JSON text
// (either a chaingraph.json node block slice, or a whole shard file's text). Shared by the monolith WRITE
// path below and shardWrite() — same upsert semantics, same field format, on different raw-text spans.
function upsertComputeImages(blockTxt, tool_id, digest) {
  const entry = `{"system":"sha256-source","image_id":${JSON.stringify(digest)},"valid_from":"${VALID_FROM}"}`;
  const ciRe = /\n( *)"compute_images": (\[.*?\]),/s;
  const m = blockTxt.match(ciRe);
  if (m) {
    const indent = m[1];
    let arr;
    try { arr = JSON.parse(m[2]); } catch { throw new Error(`bad compute_images JSON in ${tool_id}`); }
    const kept = arr.filter((i) => i.system !== 'sha256-source');
    const merged = [JSON.parse(entry), ...kept];
    const newLine = `\n${indent}"compute_images": [${merged.map((i) => JSON.stringify(i)).join(',')}],`;
    return { out: blockTxt.slice(0, m.index) + newLine + blockTxt.slice(m.index + m[0].length), kind: 'replaced' };
  }
  const ccRe = /\n( *)"compute_capability": "[a-z]+"(,?)/;
  const cm = blockTxt.match(ccRe);
  if (!cm) throw new Error(`no compute_capability anchor in ${tool_id}`);
  const indent = cm[1];
  const matchStart = cm.index;
  const matchEnd = matchStart + cm[0].length;
  if (cm[2] === ',') {
    return { out: blockTxt.slice(0, matchEnd) + `\n${indent}"compute_images": [${entry}],` + blockTxt.slice(matchEnd), kind: 'inserted' };
  }
  return { out: blockTxt.slice(0, matchStart) + `${cm[0]},\n${indent}"compute_images": [${entry}]` + blockTxt.slice(matchEnd), kind: 'inserted' };
}

// Strip every sha256-source compute_images entry from a single node object, for an apples-to-apples
// structural compare (shared "beyond compute_images, nothing else moved" safety check).
function stripSha256Source(n) {
  if (Array.isArray(n.compute_images)) {
    n.compute_images = n.compute_images.filter((i) => i.system !== 'sha256-source');
    if (n.compute_images.length === 0) delete n.compute_images;
  }
  return n;
}

async function runShardMode(mode, onlyId, registered) {
  const allShardIds = readdirSync(NODES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const targetIds = onlyId ? [onlyId] : allShardIds;

  // SKIP-GAP CROSS-CHECK (KERNELID-GATE-1): a node assembled into chaingraph.json with NO shard
  // file on disk is invisible to the scan below (it can't land in inScope OR skipped —
  // readdirSync never returns it), so shard --check would silently pass a node it never looked
  // at. assemble-chaingraph.mjs's own readShard() throws if a shard is missing for any
  // chaingraph.meta.json order.nodes id, so this "should" be structurally impossible once
  // assembled — but that invariant lives in a DIFFERENT script, so assert it here too rather
  // than assume it holds. Full-scan only (a single --shard=<id> op has nothing to cross-check).
  let populationNote = '';
  if (!onlyId) {
    const metaPath = resolve(HERE, '..', 'chaingraph.meta.json');
    const orderNodeIds = JSON.parse(readFileSync(metaPath, 'utf8')).order.nodes;
    const missingShards = orderNodeIds.filter((id) => !allShardIds.includes(id));
    if (missingShards.length) {
      console.error(`✗ §17 shard-mode SKIP GAP: ${missingShards.length} node(s) assembled into chaingraph.json (per chaingraph.meta.json order.nodes) have NO shard file on disk — shard --check cannot see them at all, which is exactly the coverage hole this cross-check exists to close:`);
      for (const id of missingShards.slice(0, 25)) console.error(`  • ${id}`);
      if (missingShards.length > 25) console.error(`  … and ${missingShards.length - 25} more`);
      process.exit(1);
    }
    populationNote = ` Cross-checked ${orderNodeIds.length} assembled node id(s) (chaingraph.meta.json order.nodes) against ${allShardIds.length} shard file(s) on disk: 0 missing.`;
  }

  const inScope = [];
  const skipped = [];
  for (const id of targetIds) {
    if (!allShardIds.includes(id)) {
      if (onlyId) { console.error(`✗ no shard file for ${id} at ${resolve(NODES_DIR, id + '.json')}`); process.exit(3); }
      continue;
    }
    const shardPath = resolve(NODES_DIR, id + '.json');
    const raw = readFileSync(shardPath, 'utf8');
    let n;
    try { n = JSON.parse(raw); } catch { console.error(`✗ shard ${id}.json does not parse as JSON`); process.exit(3); }
    const kernelPath = resolve(KDIR, n.tool_id + '.kernel.mjs');
    if (n.status === 'live' && n.gpu === false && registered.has(n.tool_id) && existsSync(kernelPath)) {
      inScope.push({ id, shardPath, raw, n, kernelPath });
    } else {
      skipped.push(id);
    }
  }
  if (onlyId && inScope.length === 0) {
    console.error(`✗ ${onlyId}: not in scope for §17 identity (need status:live, gpu:false, kernel registered in index.mjs, and a .kernel.mjs on disk)`);
    process.exit(3);
  }

  const want = new Map(); // tool_id -> sha256:digest
  for (const { n, kernelPath } of inScope) {
    const src = readFileSync(kernelPath, 'utf8');
    want.set(n.tool_id, await sourceDigest(src));
  }

  if (mode === 'check') {
    const problems = [];
    for (const { n } of inScope) {
      const imgs = Array.isArray(n.compute_images) ? n.compute_images : [];
      const src = imgs.find((i) => i.system === 'sha256-source');
      if (!src) { problems.push(`${n.tool_id}: missing sha256-source compute_images entry`); continue; }
      const norm = (d) => (typeof d === 'string' && d.startsWith('sha256:')) ? d : 'sha256:' + d;
      if (norm(src.image_id) !== want.get(n.tool_id)) {
        problems.push(`${n.tool_id}: sha256-source digest ${src.image_id} != recomputed ${want.get(n.tool_id)}`);
      }
    }
    if (problems.length) {
      console.error(`✗ §17 kernel-identity coverage FAILED (shard mode) — ${problems.length} node(s):`);
      for (const p of problems.slice(0, 25)) console.error('  • ' + p);
      if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
      console.error('\nRun: node chaingraph/kernels/gen-kernel-identity.mjs --write --shard  (then commit the shard file(s) — chaingraph.json is untouched)');
      process.exit(1);
    }
    console.log(`✓ §17 kernel-identity coverage clean (shard mode) — all ${inScope.length} in-scope shard(s) carry a current sha256-source compute_images digest. ${skipped.length} shard(s) out of scope, skipped.${populationNote}`);
    return;
  }

  // --- WRITE (shard mode) ---
  let stamped = 0, inserted = 0, replaced = 0;
  const touched = [];
  for (const { id, shardPath, raw, n } of inScope) {
    let upsert;
    try { upsert = upsertComputeImages(raw, n.tool_id, want.get(n.tool_id)); }
    catch (e) { console.error(`! ${e.message}`); process.exit(3); }

    // Safety: the shard must still parse and be identical except for the sha256-source entry.
    let afterObj;
    try { afterObj = JSON.parse(upsert.out); } catch { console.error(`✗ SAFETY: stamped shard ${id}.json does not parse — aborting, no write.`); process.exit(4); }
    const beforeStripped = JSON.stringify(stripSha256Source(JSON.parse(JSON.stringify(n))));
    const afterStripped = JSON.stringify(stripSha256Source(JSON.parse(JSON.stringify(afterObj))));
    if (beforeStripped !== afterStripped) {
      console.error(`✗ SAFETY: stamped shard ${id}.json differs beyond the sha256-source compute_images entry — aborting, no write.`);
      process.exit(4);
    }

    writeFileSync(shardPath, upsert.out);
    if (upsert.kind === 'inserted') inserted++; else replaced++;
    stamped++;
    touched.push(id);
  }
  console.log(`✓ §17 stamped ${stamped} shard(s) directly: ${inserted} inserted, ${replaced} merged into existing compute_images. chaingraph.json untouched. Run ASSEMBLE+LAND to fold into the monolith, then --check to verify.`);
  if (touched.length) console.log('  shards written: ' + touched.join(', '));
  if (skipped.length) console.log(`  ${skipped.length} shard(s) out of scope, skipped.`);
}

if (shardMode) {
  await runShardMode(mode, shardOnlyId, registeredIds);
  process.exit(0);
}

// ============================================================================
// --- DIRECT MODE (chaingraph.json monolith — assembler-side / full-coverage path, unchanged) --------
// ============================================================================

const raw = readFileSync(CGPATH, 'utf8');
const cg = JSON.parse(raw);

// In-scope = gpu:false, status live, kernel registered AND its source file exists on disk.
const inScope = (cg.nodes ?? []).filter(
  (n) => n.status === 'live' && n.gpu === false && registeredIds.has(n.tool_id)
    && existsSync(resolve(KDIR, n.tool_id + '.kernel.mjs')),
);

// Compute the desired sha256-source digest for each in-scope node.
const want = new Map(); // tool_id -> sha256:digest
for (const n of inScope) {
  const src = readFileSync(resolve(KDIR, n.tool_id + '.kernel.mjs'), 'utf8');
  want.set(n.tool_id, await sourceDigest(src));
}

// --- CHECK -----------------------------------------------------------------
if (mode === 'check') {
  const problems = [];
  for (const n of inScope) {
    const imgs = Array.isArray(n.compute_images) ? n.compute_images : [];
    const src = imgs.find((i) => i.system === 'sha256-source');
    if (!src) { problems.push(`${n.tool_id}: missing sha256-source compute_images entry`); continue; }
    const norm = (d) => (typeof d === 'string' && d.startsWith('sha256:')) ? d : 'sha256:' + d;
    if (norm(src.image_id) !== want.get(n.tool_id)) {
      problems.push(`${n.tool_id}: sha256-source digest ${src.image_id} != recomputed ${want.get(n.tool_id)}`);
    }
  }
  if (problems.length) {
    console.error(`✗ §17 kernel-identity coverage FAILED — ${problems.length} node(s):`);
    for (const p of problems.slice(0, 25)) console.error('  • ' + p);
    if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
    console.error('\nDIAGNOSIS (monolith mode — this is the PR-time brake, KERNELCI-1): if you just edited one of the listed kernels and stamped ONLY its shard via `--write --shard=<tool_id>` (SO #6 — a kernel WU never touches chaingraph.json directly), this red is EXPECTED shard/monolith drift: chaingraph.json will not reflect your change until the next ASSEMBLE-LAND regenerates it from shards. That is correct — RIDE THE NEXT ASSEMBLE-LAND, do not try to clear this red yourself, and do NOT run `--write` below (it writes chaingraph.json directly, which SO #6 forbids for a kernel-editing WU).');
    console.error('If you did NOT edit any of the listed kernels this session, this is a genuine identity mismatch (or main is carrying a stale/un-assembled chaingraph.json) — investigate before landing; do not assume drift.');
    console.error('(`--write` here is the assembler-side/full-coverage path — chaingraph.json — for the ORCH\'s ASSEMBLE-LAND step only: node chaingraph/kernels/gen-kernel-identity.mjs --write)');
    process.exit(1);
  }
  console.log(`✓ §17 kernel-identity coverage clean (monolith mode) — all ${inScope.length} in-scope gpu:false live nodes carry a current sha256-source compute_images digest.`);
  process.exit(0);
}

// --- WRITE (surgical text upsert) ------------------------------------------
// Locate each in-scope node's text span via its unique `      "tool_id": "<id>",` anchor.
const edits = []; // { start, end, replacement }
let stamped = 0, inserted = 0, replaced = 0;

for (const n of inScope) {
  // Node's own tool_id line is the SHALLOWEST-indent occurrence of this id (nested chain-step
  // refs to the same tool_id sit deeper, e.g. 10 spaces vs. 6 — but node indent isn't uniformly
  // 6 across the file, so scan all occurrences and pick the least-indented one).
  const idRe = new RegExp(`\\n( *)"tool_id": ${JSON.stringify(n.tool_id)},`, 'g');
  let m2, best = null;
  while ((m2 = idRe.exec(raw))) { if (!best || m2[1].length < best[1].length) best = m2; }
  if (!best) { console.error(`! could not locate node anchor for ${n.tool_id}`); process.exit(3); }
  const at = best.index + 1; // skip the leading \n
  const anchorLen = best[0].length - 1;
  const nodeIndent = best[1];
  // Node block ends at the next node's tool_id anchor (any indent) or EOF.
  const nextTool = raw.indexOf('\n' + nodeIndent + '"tool_id": "', at + anchorLen);
  const end = nextTool < 0 ? raw.length : nextTool;
  const blockTxt = raw.slice(at, end);

  let upsert;
  try { upsert = upsertComputeImages(blockTxt, n.tool_id, want.get(n.tool_id)); }
  catch (e) { console.error(`! ${e.message}`); process.exit(3); }
  edits.push({ start: at, end, replacement: upsert.out });
  if (upsert.kind === 'inserted') inserted++; else replaced++;
  stamped++;
}

// Apply edits high-offset-first so earlier offsets stay valid.
edits.sort((a, b) => b.start - a.start);
let out = raw;
for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);

// Safety: result must still parse and be semantically identical except for the added compute_images.
const before = JSON.stringify(cg);
const afterObj = JSON.parse(out);
// Strip every sha256-source entry from both for an apples-to-apples structural compare.
const strip = (o) => {
  for (const nn of (o.nodes ?? [])) stripSha256Source(nn);
  return o;
};
if (JSON.stringify(strip(JSON.parse(before))) !== JSON.stringify(strip(JSON.parse(JSON.stringify(afterObj))))) {
  console.error('✗ SAFETY: stamped chaingraph.json differs beyond the sha256-source compute_images entries — aborting, no write.');
  process.exit(4);
}

writeFileSync(CGPATH, out);
console.log(`✓ §17 stamped ${stamped} node(s): ${inserted} inserted, ${replaced} merged into existing compute_images. Run --check to verify.`);

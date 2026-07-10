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
// Run:  node chaingraph/kernels/gen-kernel-identity.mjs --write
//       node chaingraph/kernels/gen-kernel-identity.mjs --check

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from './_buildid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KDIR = HERE;
const CGPATH = resolve(HERE, '..', 'chaingraph.json');
const VALID_FROM = '2026-07-10';

const mode = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check' : null;
if (!mode) { console.error('usage: gen-kernel-identity.mjs --write | --check'); process.exit(2); }

const raw = readFileSync(CGPATH, 'utf8');
const cg = JSON.parse(raw);

// Registered kernel tool_ids = keys of the KERNELS map in index.mjs (text-parse, same as the worker /
// coverage gates — decoupled from kernel execution).
const idx = readFileSync(resolve(KDIR, 'index.mjs'), 'utf8');
const block = idx.slice(idx.indexOf('KERNELS = {'));
const registered = new Set([...block.matchAll(/['"]([a-z0-9][a-z0-9._-]+)['"]\s*:/gi)].map((m) => m[1]));

// In-scope = gpu:false, status live, kernel registered AND its source file exists on disk.
const inScope = (cg.nodes ?? []).filter(
  (n) => n.status === 'live' && n.gpu === false && registered.has(n.tool_id)
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
    console.error('\nRun: node chaingraph/kernels/gen-kernel-identity.mjs --write  (then commit chaingraph.json)');
    process.exit(1);
  }
  console.log(`✓ §17 kernel-identity coverage clean — all ${inScope.length} in-scope gpu:false live nodes carry a current sha256-source compute_images digest.`);
  process.exit(0);
}

// --- WRITE (surgical text upsert) ------------------------------------------
// Locate each in-scope node's text span via its unique `      "tool_id": "<id>",` anchor.
const edits = []; // { start, end, replacement }
let stamped = 0, inserted = 0, replaced = 0;

for (const n of inScope) {
  const anchor = `      "tool_id": ${JSON.stringify(n.tool_id)},`;
  const at = raw.indexOf(anchor);
  if (at < 0) { console.error(`! could not locate node anchor for ${n.tool_id}`); process.exit(3); }
  // Node block ends at the next node's tool_id anchor (or the chains array if last node).
  const nextTool = raw.indexOf('\n      "tool_id": "', at + anchor.length);
  const end = nextTool < 0 ? raw.length : nextTool;
  const blockTxt = raw.slice(at, end);

  const entry = `{"system":"sha256-source","image_id":${JSON.stringify(want.get(n.tool_id))},"valid_from":"${VALID_FROM}"}`;

  // Existing compute_images line within this node?
  const ciRe = /\n( *)"compute_images": (\[.*?\]),/s;
  const m = blockTxt.match(ciRe);
  if (m) {
    const indent = m[1];
    let arr;
    try { arr = JSON.parse(m[2]); } catch { console.error(`! bad compute_images JSON in ${n.tool_id}`); process.exit(3); }
    const kept = arr.filter((i) => i.system !== 'sha256-source');
    const merged = [JSON.parse(entry), ...kept];
    const newLine = `\n${indent}"compute_images": [${merged.map((i) => JSON.stringify(i)).join(',')}],`;
    const lineStart = at + m.index;
    edits.push({ start: lineStart, end: lineStart + m[0].length, replacement: newLine });
    replaced++;
  } else {
    // Insert a new compact compute_images line right after the node's compute_capability line.
    // compute_capability may be the LAST field (no trailing comma) — then add a comma to it and make
    // compute_images the new last field (also no trailing comma).
    const ccRe = /\n( *)"compute_capability": "[a-z]+"(,?)/;
    const cm = blockTxt.match(ccRe);
    if (!cm) { console.error(`! no compute_capability anchor in ${n.tool_id}`); process.exit(3); }
    const indent = cm[1];
    const matchStart = at + cm.index;
    const matchEnd = matchStart + cm[0].length;
    if (cm[2] === ',') {
      // Has trailing comma → simple insert after it, compute_images keeps a trailing comma.
      edits.push({ start: matchEnd, end: matchEnd, replacement: `\n${indent}"compute_images": [${entry}],` });
    } else {
      // Last field → append a comma to compute_capability and add compute_images with no trailing comma.
      edits.push({ start: matchStart, end: matchEnd, replacement: `${cm[0]},\n${indent}"compute_images": [${entry}]` });
    }
    inserted++;
  }
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
  for (const nn of (o.nodes ?? [])) {
    if (Array.isArray(nn.compute_images)) {
      nn.compute_images = nn.compute_images.filter((i) => i.system !== 'sha256-source');
      if (nn.compute_images.length === 0) delete nn.compute_images;
    }
  }
  return o;
};
if (JSON.stringify(strip(JSON.parse(before))) !== JSON.stringify(strip(JSON.parse(JSON.stringify(afterObj))))) {
  console.error('✗ SAFETY: stamped chaingraph.json differs beyond the sha256-source compute_images entries — aborting, no write.');
  process.exit(4);
}

writeFileSync(CGPATH, out);
console.log(`✓ §17 stamped ${stamped} node(s): ${inserted} inserted, ${replaced} merged into existing compute_images. Run --check to verify.`);

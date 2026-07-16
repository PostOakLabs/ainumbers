// check-proof-badge.mjs — proof-badge freshness gate (PROOFBADGE-1).
//
// WHY: node pages (`chaingraph/art-*.html`) render a proof badge — badge-warn "Proof deferred" or
// badge-green "Proof verified" — as hand-authored text baked in by per-wave `scripts/add-*-nodes.mjs`
// scripts. Nothing asserts that text against the SSOT (`chaingraph.json`), so a node proven after its
// page shipped (e.g. RHC-WAVE.land, CC-G.land) leaves the page telling readers "deferred" when the SSOT
// says "ready" — a false claim about shipped, proven work with no gate catching it (check-node-page-chrome
// and check-generator-coverage both pass; neither looks at proof status). Root cause: no owning generator.
//
// This gate asserts, for every chaingraph/art-*.html carrying a proof badge, that the badge matches the
// node's classifyNode() state from check-compute-proof-coverage.mjs (proven -> "Proof verified" / badge-green,
// deferred -> "Proof deferred" / badge-warn). Zero-dependency, node: builtins only (site repo is zero-dep).
//
// Usage:
//   node scripts/check-proof-badge.mjs             strict (CI): exit 1 on any mismatch
//   node scripts/check-proof-badge.mjs --summary    counts only, exit 0

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyNode } from './check-compute-proof-coverage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_DIR = resolve(REPO, 'chaingraph');
const CG_PATH = resolve(CG_DIR, 'chaingraph.json');

const SUMMARY = process.argv.includes('--summary');

const BADGE_RE = /<span class="badge (badge-warn|badge-green)">Proof (deferred|verified)<\/span>/;

// state -> expected badge class + text (only 'proven'/'deferred' render a badge; 'missing' has none by convention)
const EXPECTED = {
  proven: { cls: 'badge-green', text: 'verified' },
  deferred: { cls: 'badge-warn', text: 'deferred' },
};

const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));
const nodesByToolId = new Map((cg.nodes ?? []).map((n) => [n.tool_id, n]));

const files = readdirSync(CG_DIR).filter((f) => /^art-\d+.*\.html$/.test(f)).sort();

let checked = 0;
let mismatches = [];
let unmapped = [];

for (const file of files) {
  const path = resolve(CG_DIR, file);
  const html = readFileSync(path, 'utf8');
  const m = html.match(BADGE_RE);
  if (!m) continue; // page carries no proof badge — out of scope for this gate (e.g. pre-§18 template)
  checked++;

  const toolId = file.replace(/\.html$/, '');
  const node = nodesByToolId.get(toolId);
  if (!node) {
    unmapped.push({ file, reason: `no chaingraph.json node with tool_id "${toolId}"` });
    continue;
  }

  const state = classifyNode(node).state;
  const expected = EXPECTED[state];
  if (!expected) {
    mismatches.push({ file, reason: `node state is "${state}" (neither proven nor deferred) — badge cannot be asserted; fix the underlying proof/deferral first` });
    continue;
  }

  const gotCls = m[1];
  const gotText = m[2];
  if (gotCls !== expected.cls || gotText !== expected.text) {
    mismatches.push({ file, reason: `page shows ${gotCls}/"Proof ${gotText}" but SSOT node state is "${state}" (expected ${expected.cls}/"Proof ${expected.text}")` });
  }
}

if (SUMMARY) {
  console.log(`proof-badge coverage — ${checked} page(s) with a badge, ${mismatches.length} mismatch(es), ${unmapped.length} unmapped`);
  process.exit(0);
}

if (unmapped.length) {
  console.error(`✗ proof-badge gate FAILED — ${unmapped.length} page(s) carry a proof badge but have no matching chaingraph.json node:`);
  for (const u of unmapped) console.error(`  • ${u.file} — ${u.reason}`);
}

if (mismatches.length) {
  console.error(`✗ proof-badge gate FAILED — ${mismatches.length} page(s) show a proof badge that does not match the SSOT (chaingraph.json):`);
  for (const x of mismatches) console.error(`  • ${x.file} — ${x.reason}`);
  console.error('\nFix: update the page\'s <span class="badge ..."> to match compute_proof_ready/compute_proof in chaingraph.json — the SSOT is correct, the page is wrong.');
  console.error('If you believe the SSOT itself is wrong, STOP and report — do not edit chaingraph.json to make this gate pass.');
}

if (unmapped.length || mismatches.length) process.exit(1);
console.log(`✓ proof-badge gate clean — ${checked} page(s) with a proof badge, all match SSOT.`);

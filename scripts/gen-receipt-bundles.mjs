#!/usr/bin/env node
// gen-receipt-bundles.mjs — publish one RECEIPT-BUNDLE v0.1 file per FRESH proven node (RECEIPT-BUNDLE-PUBLISH-1).
//
// A THIN WRAPPER. All bundle logic lives in scripts/receipt-bundle-build.mjs (buildBundle); this file only
// decides WHICH receipts get bundled and WHERE the bytes go. It adds no field, no hashing rule and no
// canonicalization of its own (RECEIPT-BUNDLE.md §1.4, §4).
//
// Scope: every live gpu:false node whose receipt the §18 digest-freshness gate classes FRESH — the SAME
// computeStaleness() + _buildid.mjs sourceDigest() pair check-s18-digest-freshness.mjs runs, never a second
// freshness rule. ⛔ A stale receipt is never bundled: it would publish a seal over kernel bytes the site no
// longer runs. The receipt is copied from the node shard (chaingraph/graph/nodes/<tool_id>.json), and its own
// journal.kernel_digest is re-checked against the fresh recompute, so a shard that disagrees with the assembled
// graph is refused rather than published.
//
// Anchor: the published registry-lineage Sigsum record + checkpoint. Per §3.4 (NORMATIVE) that anchor commits
// to the REGISTRY CHECKPOINT, not to any individual receipt; every bundle's anchor.subject and the index say so.
//
// Single writer (SO #35): derived-artifacts-regen.yml runs this on main (COVERED id 'receipt-bundles').
// A PR never commits the output tree.
//
// ⛔ Zero network operations and zero proving (§1.2, §1.3). Pure function of committed bytes, no wall clock.
//
// Usage:
//   node scripts/gen-receipt-bundles.mjs --write   write chaingraph/receipt-bundles/ (+ prune bundles no longer in scope)
//   node scripts/gen-receipt-bundles.mjs --check   exit 1 if the tree on disk differs from what --write would produce
//   node scripts/gen-receipt-bundles.mjs           report counts only, no writes

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildBundle } from './receipt-bundle-build.mjs';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

export const OUT_DIR_REL = 'chaingraph/receipt-bundles';
export const INDEX_NAME = 'index.json';
// Tempdir writes report (REGEN-ESCAPE-GUARD-ALL-PREFIXES-1): every --write run records exactly what it
// wrote and removed, so the regen workflow stages those files rather than the bare directory prefix.
export const RECEIPT_BUNDLES_WRITES_REPORT_PATH = resolve(tmpdir(), 'ainumbers-receipt-bundles-writes.json');

// §3.4: the same subject object receipt-bundle-build.mjs writes into its fixtures. Fixture (a) reproducing
// byte-for-byte (gen-receipt-bundles.test.mjs) is what pins these two copies together.
export const REGISTRY_LINEAGE_SUBJECT = {
  kind: 'registry-checkpoint',
  origin: 'ainumbers.co/registry/lineage',
  log_policy: 'chaingraph/policies/ainumbers-registry-lineage.tlog-policy',
};

export const ANCHOR_SCOPE =
  'The log half of every bundle here commits to the registry checkpoint ainumbers.co/registry/lineage ' +
  '(registry/lineage/checkpoint), not to the receipt itself (RECEIPT-BUNDLE.md §3.4). These bundles do not ' +
  'state that any receipt is transparency-logged.';

export function lineageAnchor(repoRoot = REPO) {
  return {
    recordPath: join(repoRoot, 'registry/lineage/checkpoint.sigsum-record.json'),
    checkpointPath: join(repoRoot, 'registry/lineage/checkpoint'),
    subject: REGISTRY_LINEAGE_SUBJECT,
  };
}

/** One bundle's published bytes. `note` exists only so the selftest can reproduce the §5 fixtures, which
 *  carry a build_note; published bundles pass none, so they carry §2 members only. */
export async function renderBundle({ receipt, receiptSourcePath, anchor, note, repoRoot = REPO }) {
  const bundle = await buildBundle({ receipt, receiptSourcePath, anchor, repoRoot, note });
  return JSON.stringify(bundle, null, 2) + '\n';
}

export function shardPath(toolId) {
  return `chaingraph/graph/nodes/${toolId}.json`;
}

/**
 * Bundle one node. Refuses unless the shard's own receipt carries exactly the kernel digest the fresh
 * recompute produced: `freshDigest` is the s18 gate's recomputed sourceDigest for this node's kernel.
 */
export async function bundleForNode({ toolId, freshDigest, repoRoot = REPO }) {
  const rel = shardPath(toolId);
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) throw new Error(`${toolId}: no node shard at ${rel}`);
  const shard = JSON.parse(readFileSync(abs, 'utf8'));
  const receipt = shard.audit_signature?.compute_proof ?? shard.compute_proof;
  if (!receipt || !receipt.journal) throw new Error(`${toolId}: shard carries no compute_proof`);
  if (typeof freshDigest !== 'string' || receipt.journal.kernel_digest !== freshDigest) {
    throw new Error(
      `${toolId}: STALE receipt refused. journal.kernel_digest=${receipt.journal.kernel_digest} but the ` +
      `currently-deployed kernel recomputes to ${freshDigest}. Bundling it would publish a seal over bytes ` +
      `the site no longer runs.`
    );
  }
  return renderBundle({ receipt, receiptSourcePath: rel, anchor: lineageAnchor(repoRoot), repoRoot });
}

/** The full expected tree as { relPath -> bytes }. Pure function of committed bytes. */
export async function expectedTree({ repoRoot = REPO } = {}) {
  const cg = JSON.parse(readFileSync(join(repoRoot, 'chaingraph/chaingraph.json'), 'utf8'));
  const kdir = join(repoRoot, 'chaingraph/kernels');
  const { sourceDigest } = await import(pathToFileURL(join(kdir, '_buildid.mjs')).href);
  const live = (cg.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
  const sources = {};
  for (const n of live) {
    const p = join(kdir, `${n.tool_id}.kernel.mjs`);
    if (existsSync(p)) sources[n.tool_id] = readFileSync(p, 'utf8');
  }
  const { fresh, stale } = await computeStaleness(cg, sources, sourceDigest);
  if (fresh.length === 0 && stale.length > 0) {
    // The s18 gate's calibration rule: zero fresh means the instrument is wrong, never that nothing is fresh.
    throw new Error('calibration failed: zero receipts recompute as fresh; refusing to publish anything');
  }
  const files = new Map();
  const entries = [];
  for (const r of [...fresh].sort((a, b) => a.tool_id.localeCompare(b.tool_id))) {
    const bytes = await bundleForNode({ toolId: r.tool_id, freshDigest: r.recomputed, repoRoot });
    const rel = `${OUT_DIR_REL}/${r.tool_id}.bundle.json`;
    files.set(rel, bytes);
    entries.push({
      tool_id: r.tool_id,
      mcp_name: r.name,
      bundle: `${r.tool_id}.bundle.json`,
      receipt_source: shardPath(r.tool_id),
      kernel_digest: r.recomputed,
    });
  }
  const index = {
    bundle_version: '0.1',
    spec: 'chaingraph/standard/RECEIPT-BUNDLE.md',
    scope: 'One bundle per live node whose receipt is fresh under the §18 digest-freshness check (journal.kernel_digest equals the currently-deployed kernel source). Stale receipts are never bundled.',
    anchor_scope: ANCHOR_SCOPE,
    anchor_subject: REGISTRY_LINEAGE_SUBJECT,
    verify: 'node scripts/receipt-bundle-verify.mjs <bundle.json>',
    count: entries.length,
    bundles: entries,
  };
  files.set(`${OUT_DIR_REL}/${INDEX_NAME}`, JSON.stringify(index, null, 2) + '\n');
  return files;
}

function onDisk(repoRoot) {
  const dir = join(repoRoot, OUT_DIR_REL);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => `${OUT_DIR_REL}/${f}`);
}

async function main(argv) {
  const args = argv.slice(2);
  const files = await expectedTree();
  const present = onDisk(REPO);
  const stray = present.filter((p) => !files.has(p));

  if (args.includes('--check')) {
    const drift = [];
    for (const [rel, bytes] of files) {
      const abs = join(REPO, rel);
      if (!existsSync(abs)) drift.push(`missing ${rel}`);
      else if (readFileSync(abs, 'utf8') !== bytes) drift.push(`stale ${rel}`);
    }
    for (const p of stray) drift.push(`out of scope ${p}`);
    if (drift.length) {
      console.log(`✗ receipt-bundles: ${drift.length} file(s) differ from a fresh build:`);
      for (const d of drift.slice(0, 20)) console.log(`  ${d}`);
      if (drift.length > 20) console.log(`  … ${drift.length - 20} more`);
      console.log('  Regenerate with: node scripts/gen-receipt-bundles.mjs --write (main-side regen owns this tree, SO #35)');
      return 1;
    }
    console.log(`✓ receipt-bundles: ${files.size - 1} bundle(s) + index fresh`);
    return 0;
  }

  if (args.includes('--write')) {
    mkdirSync(join(REPO, OUT_DIR_REL), { recursive: true });
    const written = [];
    for (const [rel, bytes] of files) {
      const abs = join(REPO, rel);
      if (existsSync(abs) && readFileSync(abs, 'utf8') === bytes) continue;
      writeFileSync(abs, bytes);
      written.push(rel);
    }
    for (const p of stray) rmSync(join(REPO, p));
    writeFileSync(RECEIPT_BUNDLES_WRITES_REPORT_PATH, JSON.stringify({ written, removed: stray }, null, 2) + '\n');
    console.log(`receipt-bundles: ${files.size - 1} bundle(s) in scope; wrote ${written.length}, removed ${stray.length}`);
    return 0;
  }

  console.log(`receipt-bundles: ${files.size - 1} fresh receipt(s) in scope; ${present.length} file(s) on disk (report only, no writes)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then((c) => process.exit(c)).catch((e) => { console.error(e.message || e); process.exit(1); });
}

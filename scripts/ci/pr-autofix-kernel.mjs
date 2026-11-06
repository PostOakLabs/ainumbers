#!/usr/bin/env node
/**
 * scripts/ci/pr-autofix-kernel.mjs — the kernel-PR writers of .github/workflows/pr-autofix.yml,
 * each fenced by its own path allowlist.
 *
 * WHY A SCRIPT. The workflow's generic containment lets a writer rewrite any file in the PR's
 * touched set. That is too loose for a kernel PR: a stamp writer that rewrote a shared derived
 * artifact the PR happened to touch would pass it. Here every writer has a path allowlist of
 * its own, checked against the tree delta that writer produced, so no writer can ever touch a
 * shared derived artifact (catalog, sitemap, chaingraph.json, index.html, counts, ...), which
 * have a single writer: derived-artifacts-regen.yml on main.
 *
 * WRITERS (each runs only when its trigger is in the PR's touched set):
 *   kernel-identity  trigger: chaingraph/kernels/<id>.kernel.mjs
 *                    runs:    node chaingraph/kernels/gen-kernel-identity.mjs --write --shard=<id>
 *                    allow:   chaingraph/graph/nodes/<id>.json  (the PR's own node shard)
 *                    Shard mode never opens chaingraph.json, and writes only the stamped shard.
 *   input-schema     trigger: chaingraph/kernels/<id>.kernel.mjs
 *                    runs:    node scripts/gen-input-schemas.mjs --write --only <id>
 *                    allow:   manifests/<id>.manifest.json  (the PR's own manifest)
 *                    Hand-curated schemas (no provenance mark) are never overwritten by the
 *                    tool; a non-zero exit (e.g. id outside its backfill plan) is a warning.
 *   root-chrome      trigger: a root-level *.html page in the PR's touched set
 *                    runs:    node scripts/gen-root-chrome.mjs
 *                    allow:   only those touched root pages that are NOT shared derived
 *                             artifacts (scripts/derived-artifacts.mjs coveredPaths()).
 *                    The writer sweeps every root page it knows; rewrites outside the
 *                    allowlist are reverted and named, never kept.
 *
 * NOT AUTOFIXED, ON PURPOSE: the page kernel-digest meta. No writer exists for it, and writing
 * one would defeat the gate: the sentinel attests that the page's inline compute copy was
 * rebuilt from the kernel. Re-stamping the digest alone would bless a stale inline copy.
 *
 * HARD STOP. After each writer, any path changed outside its allowlist is reverted and the run
 * exits 1 (identity and input-schema), so nothing outside the fence reaches a patch.
 *
 * Every git spawn here passes env: gitEnv() (scripts/_git-env-lib.mjs).
 *
 * Usage:
 *   node scripts/ci/pr-autofix-kernel.mjs --touched <nul-delimited-file>   run the writers
 *   node scripts/ci/pr-autofix-kernel.mjs --extras  <nul-delimited-file>   print extra allowed paths
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitEnv } from '../_git-env-lib.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Tool ids are filename stems; refuse anything outside the estate's id alphabet. */
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const KERNEL_RE = /^chaingraph\/kernels\/([^/]+)\.kernel\.mjs$/;

/** Kernel ids named by the touched set whose kernel file still exists (deletions excluded). */
export function kernelIds(touched, exists = (p) => existsSync(resolve(REPO, p))) {
  const ids = [];
  for (const f of touched) {
    const m = KERNEL_RE.exec(f);
    if (m && ID_RE.test(m[1]) && exists(f) && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/** Root-level *.html pages in the touched set (no directory component). */
export function rootPages(touched) {
  return touched.filter((f) => /^[^/]+\.html$/.test(f) && !f.includes('\\'));
}

/** Allowlist per writer for a touched set. `covered` = shared derived artifact paths. */
export function allowlists(touched, covered, exists) {
  const ids = kernelIds(touched, exists);
  const coveredSet = new Set(covered);
  return {
    'kernel-identity': ids.map((id) => `chaingraph/graph/nodes/${id}.json`),
    'input-schema': ids.map((id) => `manifests/${id}.manifest.json`),
    'root-chrome': rootPages(touched).filter((p) => !coveredSet.has(p)),
  };
}

/** Union of all writer allowlists, for the generic containment step. */
export function extraAllowed(touched, covered, exists) {
  return [...new Set(Object.values(allowlists(touched, covered, exists)).flat())].sort();
}

/** Paths changed in the working tree (tracked edits and untracked files). */
export function dirtyPaths(cwd = REPO) {
  const r = spawnSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd, env: gitEnv(), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git status failed: ${r.stderr}`);
  const out = [];
  const recs = r.stdout.split('\0');
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (!rec) continue;
    out.push(rec.slice(3));
    if (rec[0] === 'R' || rec[0] === 'C') i++; // rename/copy carries the origin as a second record
  }
  return out.sort();
}

/** Revert one path to HEAD (tracked) or delete it (untracked). */
function revert(p, cwd = REPO) {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', p], { cwd, env: gitEnv() }).status === 0;
  if (tracked) spawnSync('git', ['checkout', '--', p], { cwd, env: gitEnv() });
  else spawnSync('git', ['clean', '-f', '--', p], { cwd, env: gitEnv() });
}

function readNul(file) {
  return readFileSync(file, 'utf8').split('\0').filter(Boolean);
}

function runNode(args) {
  console.log(`> node ${args.join(' ')}`);
  return spawnSync(process.execPath, args, { cwd: REPO, stdio: 'inherit' }).status;
}

async function main() {
  const argv = process.argv.slice(2);
  const ti = argv.indexOf('--touched');
  const ei = argv.indexOf('--extras');
  const file = ti !== -1 ? argv[ti + 1] : ei !== -1 ? argv[ei + 1] : null;
  if (!file) { console.error('usage: pr-autofix-kernel.mjs --touched <file> | --extras <file>'); process.exit(2); }
  const touched = readNul(file);
  const { coveredPaths } = await import('../derived-artifacts.mjs');
  const covered = coveredPaths();

  if (ei !== -1) { for (const p of extraAllowed(touched, covered)) console.log(p); return; }

  const lists = allowlists(touched, covered);
  const ids = kernelIds(touched);
  let before = new Set(dirtyPaths());
  let failed = false;

  /** Fence one writer: revert-and-report anything it changed outside its allowlist. */
  function fence(writer, hard) {
    const allow = new Set(lists[writer]);
    const now = dirtyPaths();
    const delta = now.filter((p) => !before.has(p));
    const escaped = delta.filter((p) => !allow.has(p));
    for (const p of escaped) revert(p);
    if (escaped.length) {
      console.error(`::${hard ? 'error' : 'warning'} title=${writer} wrote outside its allowlist::${escaped.join(', ')}`);
      if (hard) failed = true;
    }
    before = new Set(dirtyPaths());
  }

  for (const id of ids) {
    if (!existsSync(resolve(REPO, `chaingraph/graph/nodes/${id}.json`))) {
      console.log(`  skip kernel-identity for ${id}: no node shard (the assembler path owns it)`);
    } else if (runNode(['chaingraph/kernels/gen-kernel-identity.mjs', '--write', `--shard=${id}`]) !== 0) {
      console.error(`::error title=gen-kernel-identity failed for ${id}::the writer exited non-zero`);
      failed = true;
    }
    fence('kernel-identity', true);

    // Best effort: a non-zero exit means the id is outside the backfill plan or the
    // schema is hand-curated, which is a hand edit for the PR author, not a fix.
    if (runNode(['scripts/gen-input-schemas.mjs', '--write', '--only', id]) !== 0) {
      console.log(`::warning title=gen-input-schemas --only ${id} exited non-zero::nothing to backfill, or a hand-curated schema.`);
    }
    fence('input-schema', true);
  }

  if (lists['root-chrome'].length) {
    runNode(['scripts/gen-root-chrome.mjs']);
    fence('root-chrome', false);
  }

  if (failed) process.exit(1);
  console.log('pr-autofix-kernel: every write sits inside its writer allowlist.');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });

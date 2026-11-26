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
 *                    A node with no manifest on the PR tree is a skip with a notice: the
 *                    writer updates an existing manifest, it never creates one (2026-11-15,
 *                    #3136: the create path laid down a manifest for a manifest-less node).
 *   root-chrome      trigger: a root-level *.html page in the PR's touched set
 *                    runs:    node scripts/gen-root-chrome.mjs
 *                    allow:   only those touched root pages that are NOT shared derived
 *                             artifacts (scripts/derived-artifacts.mjs coveredPaths()).
 *                    The writer sweeps every root page it knows; rewrites outside the
 *                    allowlist are reverted and named, never kept.
 *   proof-links      trigger: chaingraph/kernels/<id>.kernel.mjs OR chaingraph/graph/nodes/<id>.json
 *                    runs:    node scripts/gen-proof-links.mjs --only <id>
 *                    allow:   chaingraph/<id>.html  (the PR's own node page), and inside it ONLY
 *                             the <!--PROOF-LINKS--> region.
 *                    PR-AUTOFIX-PROOFLINKS-ON-KERNEL-1. The block names the kernel digest, the
 *                    receipt, the shard's proof and the registry record, so a kernel edit or a
 *                    re-prove moves it even when the PR never touched the page. pr-autofix.yml's
 *                    page step already rewrote it (#3295), but only for pages in the touched set,
 *                    so re-prove PRs hand-healed it (#3239, #3285). Only ids gen-proof-links owns
 *                    run (a node shard AND a top-level chaingraph/<id>.html). The page IS in
 *                    coveredPaths() (node-page-proof-links and node-page-footers own regions of
 *                    it), so this is the one writer allowed onto a covered path, and it is fenced
 *                    to its own region: any byte changed outside the block is reverted and fails
 *                    the run. A writer crash is a warning (the gate is advisory on a PR), so it
 *                    never eats the identity stamp or schema in the same push.
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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

const SHARD_RE = /^chaingraph\/graph\/nodes\/([^/]+)\.json$/;

/**
 * Node ids whose proof-links block this PR can move: a kernel or node shard in the touched set
 * (deletions excluded), limited to the pages gen-proof-links owns (proofLinkPages(): a node
 * shard AND a top-level chaingraph/<id>.html on the PR tree).
 */
export function proofLinkIds(touched, exists = (p) => existsSync(resolve(REPO, p))) {
  const ids = [];
  for (const f of touched) {
    const m = KERNEL_RE.exec(f) || SHARD_RE.exec(f);
    if (!m || !ID_RE.test(m[1]) || !exists(f) || ids.includes(m[1])) continue;
    const id = m[1];
    if (exists(`chaingraph/graph/nodes/${id}.json`) && exists(`chaingraph/${id}.html`)) ids.push(id);
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
    // A covered path on purpose: see the proof-links entry in the header. The region fence in
    // proofLinksStep keeps the write inside the block.
    'proof-links': proofLinkIds(touched, exists).map((id) => `chaingraph/${id}.html`),
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

/** Run a node script, echo its output, and return { status, output } for classification. */
function runNode(args, extraEnv = {}) {
  console.log(`> node ${args.join(' ')}`);
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return { status: r.status, output: `${r.stdout || ''}${r.stderr || ''}` };
}

/** The identity writer exits 3 with this line when the shard is not live/enrolled yet. */
const NOT_APPLICABLE_RE = /not in scope for \S{0,3}17 identity/;

/**
 * Classify one identity-writer run: 'ok' (exit 0), 'skip' (known not-applicable precondition:
 * exit 3 AND the not-in-scope message), or 'fail' (anything else, a real writer error).
 */
export function classifyIdentity({ status, output }) {
  if (status === 0) return 'ok';
  if (status === 3 && NOT_APPLICABLE_RE.test(output || '')) return 'skip';
  return 'fail';
}

/**
 * Run the identity writer for one id. Returns 'ok' | 'skip' | 'fail'. Missing shard (node not
 * yet in the monolith or assembler-owned) is a skip. `run` and `hasShard` are injectable.
 *
 * `touchedIds` is the kernel ids of the WHOLE PR (the touched set this script was handed). It is
 * passed to the writer as KERNELID_TOUCHED_IDS. Without it the writer derives "touched" from
 * `git diff HEAD^1 HEAD`, which is only right on the merge ref; this job checks out the PR head
 * commit, where HEAD^1 is the previous branch commit (or, after a main merge, the old tip), so a
 * brand-new kernel that the last commit did not touch (and that index.mjs does not register yet)
 * read as "not in scope" and was never stamped (2026-11-10, #2894).
 */
export function identityStep(id, run, hasShard, touchedIds) {
  if (!hasShard(id)) {
    console.log(`::notice title=kernel-identity skipped for ${id}::no node shard (the assembler path owns it)`);
    return 'skip';
  }
  const args = ['chaingraph/kernels/gen-kernel-identity.mjs', '--write', `--shard=${id}`];
  const res = classifyIdentity(Array.isArray(touchedIds) ? run(args, { KERNELID_TOUCHED_IDS: touchedIds.join(',') }) : run(args));
  if (res === 'skip') console.log(`::notice title=kernel-identity skipped for ${id}::shard is not live/enrolled yet, nothing to stamp`);
  else if (res === 'fail') console.error(`::error title=gen-kernel-identity failed for ${id}::the writer exited non-zero`);
  return res;
}

/**
 * Run the schema writer for one id. Returns 'ok' | 'skip'. A node with no manifest on the PR
 * tree is a skip: gen-input-schemas.mjs would take its BACKFILL-CREATE path and lay down a
 * manifest this PR's node never had (2026-11-15, #3136 — the job then reds webmcp-meta-budgets
 * on a file no gate here can judge). The writer updates an existing manifest and never creates
 * one. `run` and `hasManifest` are injectable.
 */
export function inputSchemaStep(id, run, hasManifest) {
  if (!hasManifest(id)) {
    console.log(`::notice title=input-schema skipped for ${id}::no manifest for this id on the PR tree; the writer updates an existing manifest, it never creates one`);
    return 'skip';
  }
  // Best effort: a non-zero exit means the id is outside the backfill plan or the
  // schema is hand-curated, which is a hand edit for the PR author, not a fix.
  if (run(['scripts/gen-input-schemas.mjs', '--write', '--only', id]).status !== 0) {
    console.log(`::warning title=gen-input-schemas --only ${id} exited non-zero::nothing to backfill, or a hand-curated schema.`);
  }
  return 'ok';
}

// Sentinels written by scripts/gen-proof-links.mjs (START / END there).
const PL_START = '<!--PROOF-LINKS-->';
const PL_END = '<!--/PROOF-LINKS-->';

/**
 * True when `after` differs from `before` only inside the PROOF-LINKS block: the block was
 * replaced in place, or (no block before) inserted the way gen-proof-links' withBlock() inserts
 * it, as `[\n]<block>\n` directly above the footer. Anything else changed is an escape.
 */
export function onlyProofLinksChanged(before, after) {
  if (before === after) return true;
  const a = after.indexOf(PL_START);
  const b = a === -1 ? -1 : after.indexOf(PL_END, a);
  if (b === -1) return false;
  const prefix = after.slice(0, a);
  const suffix = after.slice(b + PL_END.length);
  const s = before.indexOf(PL_START);
  const e = s === -1 ? -1 : before.indexOf(PL_END, s);
  if (e !== -1) return prefix === before.slice(0, s) && suffix === before.slice(e + PL_END.length);
  if (s !== -1) return false; // a half block before: refuse rather than guess
  if (!suffix.startsWith('\n')) return false;
  const rest = suffix.slice(1);
  return prefix + rest === before || (prefix.endsWith('\n') && prefix.slice(0, -1) + rest === before);
}

/**
 * Run the proof-links writer for one id. Returns 'ok' (block rewritten), 'unchanged',
 * 'error' (writer exited non-zero: a warning, the caller reverts the page) or 'escaped'
 * (bytes outside the block moved: the caller reverts and fails). `run` and `readPage` are
 * injectable; `readPage` returns '' for a missing page.
 */
export function proofLinksStep(id, run, readPage) {
  const page = `chaingraph/${id}.html`;
  const before = readPage(page);
  const res = run(['scripts/gen-proof-links.mjs', '--only', id]);
  const after = readPage(page);
  if (res.status !== 0) {
    console.log(`::warning title=gen-proof-links --only ${id} exited non-zero::the page is left as the PR had it; main's regen re-derives the block after merge.`);
    return 'error';
  }
  if (before === after) return 'unchanged';
  if (!onlyProofLinksChanged(before, after)) {
    console.error(`::error title=proof-links wrote outside its block::${page} changed outside <!--PROOF-LINKS-->; the write is reverted`);
    return 'escaped';
  }
  return 'ok';
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
    if (identityStep(id, runNode, (i) => existsSync(resolve(REPO, `chaingraph/graph/nodes/${i}.json`)), ids) === 'fail') failed = true;
    fence('kernel-identity', true);

    // The writer updates an existing manifest and never creates one; a manifest-less id
    // is a skip with a notice (see inputSchemaStep).
    inputSchemaStep(id, runNode, (i) => existsSync(resolve(REPO, `manifests/${i}.manifest.json`)));
    fence('input-schema', true);
  }

  if (lists['root-chrome'].length) {
    runNode(['scripts/gen-root-chrome.mjs']);
    fence('root-chrome', false);
  }

  // Proof-links block on the node page, from the PR's own kernel and shard (a kernel edit or a
  // re-prove moves it even when the page is not in the touched set).
  const readPage = (p) => { const abs = resolve(REPO, p); return existsSync(abs) ? readFileSync(abs, 'utf8') : ''; };
  for (const id of proofLinkIds(touched)) {
    const page = `chaingraph/${id}.html`;
    const prior = readPage(page);
    const res = proofLinksStep(id, runNode, readPage);
    if (res === 'error' || res === 'escaped') {
      // Restore the page to what it was before this writer ran, not to HEAD: the page step in
      // pr-autofix.yml may already have rewritten a touched page earlier in the job.
      writeFileSync(resolve(REPO, page), prior);
      if (res === 'escaped') failed = true;
    }
    fence('proof-links', true);
  }

  if (failed) process.exit(1);
  console.log('pr-autofix-kernel: every write sits inside its writer allowlist.');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });

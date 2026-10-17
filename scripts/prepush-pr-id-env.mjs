#!/usr/bin/env node
/**
 * scripts/prepush-pr-id-env.mjs — PREPUSH-PRID-ENV-1.
 *
 * check-id-collision.mjs (leg: open-PR claims) needs to know THIS push's PR
 * number so it does not flag the PR's own title as a rival claim; it reads it
 * from PR_ID_COLLISION_PR (thisPrNumber()). In CI that comes from the ref name;
 * locally nothing set it. This helper lets .githooks/pre-push export it.
 *
 * Usage (hook):
 *   printf '%s\n' "$refs_stdin" | node scripts/prepush-pr-id-env.mjs --head <sha> --added-file <path>...
 * Prints the PR number (digits only) on stdout, or NOTHING. Exit code is ALWAYS 0:
 * any error, timeout, missing gh, closed/merged PR, branch mismatch, wrong repo
 * -> print nothing. Never fails the push.
 *
 * It queries gh ONLY when the diff mints a new node/manifest id (added file
 * matching NODE_RE/MANIFEST_RE of check-id-collision.mjs), and exports only when
 * the PR is OPEN, its headRefName equals the pushed branch (taken from the
 * pre-push stdin: `<local ref> <local sha> <remote ref> <remote sha>`), in repo
 * PostOakLabs/ainumbers (passed explicitly with -R).
 *
 * `--self-test` runs red/green controls with an injected gh runner.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REPO_SLUG = 'PostOakLabs/ainumbers';
const NODE_RE = /^chaingraph\/graph\/nodes\/art-(\d+)-[^/]+\.json$/;
const MANIFEST_RE = /^manifests\/art-(\d+)-[^/]+\.manifest\.json$/;

export function mintsNewId(addedPaths) {
  return addedPaths.some((p) => NODE_RE.test(p) || MANIFEST_RE.test(p));
}

/** Branch being pushed: the refs/heads/ remote ref whose local sha is HEAD (or the sole branch ref). */
export function pushedBranch(stdinText, headSha) {
  const rows = String(stdinText).split('\n').map((l) => l.trim().split(/\s+/)).filter((c) => c.length >= 4 && c[2].startsWith('refs/heads/'));
  const mine = rows.filter((c) => c[1] === headSha);
  const pick = mine.length === 1 ? mine[0] : (rows.length === 1 && !headSha ? rows[0] : null);
  return pick ? pick[2].slice('refs/heads/'.length) : null;
}

function realGh(branch) {
  const args = ['pr', 'view', branch, '-R', REPO_SLUG, '--json', 'number,state,headRefName'];
  const opts = { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] };
  // TEST-ONLY seam: PREPUSH_PRID_GH_JS=<file.js> runs that script under node in place of
  // `gh` (an extension-less fake `gh` is not spawnable by node on Windows).
  if (process.env.PREPUSH_PRID_GH_JS) return execFileSync(process.execPath, [process.env.PREPUSH_PRID_GH_JS, ...args], opts);
  return execFileSync('gh', args, opts);
}

/** Returns the PR number string to export, or '' (never throws). */
export function resolvePrNumber({ stdinText, headSha, addedPaths, gh = realGh }) {
  try {
    if (!mintsNewId(addedPaths)) return '';
    const branch = pushedBranch(stdinText, headSha);
    if (!branch) return '';
    const pr = JSON.parse(gh(branch));
    if (!pr || pr.state !== 'OPEN' || pr.headRefName !== branch) return '';
    if (!Number.isInteger(pr.number) || pr.number <= 0) return '';
    return String(pr.number);
  } catch {
    return '';
  }
}

function selfTest() {
  const sha = 'a'.repeat(40);
  const stdin = `refs/heads/feat-x ${sha} refs/heads/feat-x ${'0'.repeat(40)}\n`;
  const mint = ['chaingraph/graph/nodes/art-900-new-thing.json'];
  const noMint = ['tools/152-baas-provider-comparator.html', 'chaingraph/graph/nodes/art-900-new-thing.json.bak'];
  const open = () => JSON.stringify({ number: 4242, state: 'OPEN', headRefName: 'feat-x' });
  const cases = [
    ['GREEN: open PR, matching branch, mints node id -> exported', { addedPaths: mint, gh: open }, '4242'],
    ['GREEN: manifest mint also counts', { addedPaths: ['manifests/art-901-x.manifest.json'], gh: open }, '4242'],
    ['RED: closed PR -> not exported', { addedPaths: mint, gh: () => JSON.stringify({ number: 4242, state: 'CLOSED', headRefName: 'feat-x' }) }, ''],
    ['RED: merged PR -> not exported', { addedPaths: mint, gh: () => JSON.stringify({ number: 4242, state: 'MERGED', headRefName: 'feat-x' }) }, ''],
    ['RED: wrong headRefName -> not exported', { addedPaths: mint, gh: () => JSON.stringify({ number: 7, state: 'OPEN', headRefName: 'other' }) }, ''],
    ['RED: gh errors/times out -> nothing, no throw', { addedPaths: mint, gh: () => { throw new Error('ETIMEDOUT'); } }, ''],
    ['RED: gh prints garbage -> nothing', { addedPaths: mint, gh: () => 'not json' }, ''],
    ['RED: non-positive number -> nothing', { addedPaths: mint, gh: () => JSON.stringify({ number: 0, state: 'OPEN', headRefName: 'feat-x' }) }, ''],
    ['GREEN(skip): no new id minted -> gh never called, nothing exported', { addedPaths: noMint, gh: () => { throw new Error('gh must not be called'); } }, ''],
    ['RED: pushed ref is not HEAD -> ambiguous, nothing', { addedPaths: mint, headSha: 'b'.repeat(40), gh: open }, ''],
    ['RED: tag push (no refs/heads) -> nothing', { addedPaths: mint, stdinText: `refs/tags/v1 ${sha} refs/tags/v1 ${'0'.repeat(40)}\n`, gh: open }, '']
  ];
  let bad = 0;
  for (const [name, args, want] of cases) {
    const got = resolvePrNumber({ stdinText: stdin, headSha: sha, ...args });
    if (got !== want) { bad++; console.error(`✗ ${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
    else console.log(`✓ ${name}`);
  }
  if (bad) { console.error(`❌ prepush-pr-id-env self-test: ${bad} failure(s)`); process.exit(1); }
  console.log(`✅ prepush-pr-id-env self-test: ${cases.length} controls passed`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    try {
      const a = process.argv.slice(2);
      const headSha = a[a.indexOf('--head') + 1] || '';
      const i = a.indexOf('--added-file');
      const addedPaths = i === -1 ? [] : readFileSync(a[i + 1], 'utf8').split('\n').filter(Boolean);
      const stdinText = readFileSync(0, 'utf8');
      const out = resolvePrNumber({ stdinText, headSha, addedPaths });
      if (out) process.stdout.write(out);
    } catch { /* never fail the push */ }
    process.exit(0);
  }
}

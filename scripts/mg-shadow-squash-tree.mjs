#!/usr/bin/env node
/**
 * scripts/mg-shadow-squash-tree.mjs — MERGE-GROUP-SHADOW-SQUASH-SIM-1
 *
 * Builds the tree the merge queue will actually land: origin/main plus the PR
 * head squashed into ONE commit. The queue squashes (repo setting
 * squash_merge_commit_message=COMMIT_MESSAGES, title COMMIT_OR_PR_TITLE), so any
 * text that lives only in a merge commit of the PR branch (#2342: a
 * REPROVE-AUTHORIZED line) is dropped from the commit message the queue's gates
 * read. The pull_request merge ref still carries it, which is why a PR can be
 * green on the PR side and red in the queue.
 *
 * Message = PR title as subject, then the PR's NON-merge commit messages in
 * order (`git log --no-merges --reverse --format=%B <base>..<head>`).
 *
 *   node scripts/mg-shadow-squash-tree.mjs --head <sha> --title <text> --out <dir> [--base origin/main]
 *
 * <dir> becomes a detached throwaway worktree (never the job's checkout). Exits 1
 * when the squash does not apply cleanly (the queue would refuse it too).
 * Self-test: scripts/check-mg-shadow-parity.test.mjs.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** Squash-commit message the queue would write (pure; exported for the test). */
export function squashMessage(title, bodies) {
  return `${title}\n\n${bodies.trim()}\n`;
}

/**
 * Build the squash tree. `repo` is any checkout holding both refs. Returns
 * { ok, dir, sha, message } or { ok:false, error }.
 */
export function buildSquashTree({ repo = REPO, head, title, out, base = 'origin/main' }) {
  const bodies = git(repo, ['log', '--no-merges', '--reverse', '--format=%B', `${base}..${head}`]);
  if (!bodies.ok) return { ok: false, error: `git log failed: ${bodies.err}` };
  const wt = git(repo, ['worktree', 'add', '--detach', out, base]);
  if (!wt.ok) return { ok: false, error: `worktree add failed: ${wt.err}` };
  const sq = git(out, ['merge', '--squash', head]);
  if (!sq.ok) return { ok: false, error: `squash does not apply cleanly: ${sq.err || sq.out}` };
  const message = squashMessage(title, bodies.out);
  const ci = git(out, ['-c', 'user.name=mg-shadow', '-c', 'user.email=mg-shadow@invalid', 'commit', '--allow-empty', '--no-verify', '-m', message]);
  if (!ci.ok) return { ok: false, error: `commit failed: ${ci.err}` };
  return { ok: true, dir: out, sha: git(out, ['rev-parse', 'HEAD']).out, message };
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  const head = val('--head'), title = val('--title'), out = val('--out'), base = val('--base') || 'origin/main';
  if (!head || !title || !out) {
    console.error('usage: mg-shadow-squash-tree.mjs --head <sha> --title <text> --out <dir> [--base origin/main]');
    process.exit(2);
  }
  const r = buildSquashTree({ head, title, out: resolve(out), base });
  if (!r.ok) { console.error('✗ mg-shadow squash tree: ' + r.error); process.exit(1); }
  console.log(`✓ squash-faithful tree at ${r.dir} (${r.sha.slice(0, 8)}) = ${base} + ${head.slice(0, 8)}`);
}

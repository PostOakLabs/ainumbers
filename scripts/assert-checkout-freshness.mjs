#!/usr/bin/env node
/**
 * scripts/assert-checkout-freshness.mjs — AUDIT-FRESHNESS-ASSERT-1
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS — Tim popup ruling 2026-08-22 (gate-integrity wave), anchored on SO #48.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SO #48 already bans a stale local checkout as verification surface ("HEAD ≠ origin/main at
 * measurement time = the evidence is VOID") — but SO #48 is prose, and prose did not stop the
 * gate-integrity audit itself from nearly re-reporting ~100-commit-stale defects. This is the
 * mechanical precondition: ONE command an audit or sweep session runs BEFORE READING ANYTHING,
 * that fetches, compares HEAD to the remote-tracking ref, and REFUSES (non-zero exit) on any
 * drift — naming exactly how far behind, never silently continuing on stale ground.
 *
 * Verdict tokens are the enum-v2 vocabulary at workspace-root `board/row-state-enum.json` (SSOT).
 * This script hardcodes the literal token strings rather than importing that file, because it
 * must also run from a bare `ainumbers` checkout with no sibling `board/` directory (e.g. CI,
 * or a clone of this repo with no surrounding workspace).
 *
 * Usage:
 *   node scripts/assert-checkout-freshness.mjs [<path>] [--ref <remote>/<branch>]
 *
 *     <path>              git checkout to verify (default: cwd). Detached HEAD and linked
 *                         worktrees are fully supported — `git rev-parse HEAD` resolves the same
 *                         way regardless, which is where an audit session actually runs (SO #50).
 *     --ref <remote>/<branch>   remote-tracking ref to compare HEAD against. Default
 *                         `origin/main` (the site repo). Pass `origin/master` for the worker
 *                         repo (`mcp-apps-poc/`), which still uses `master` as its default branch.
 *
 * Prints exactly one verdict line naming both SHAs (or the reason evaluation was impossible),
 * then an `elapsed_ms=<n>` line, then exits:
 *
 *   FRESH                   exit 0  — HEAD == <ref>. Safe to use as verification evidence.
 *   STALE                   exit 1  — HEAD is N commits behind <ref>. REFUSED — naming the drift.
 *   MISMATCH                exit 1  — HEAD is ahead of / diverged from <ref>, or shares no common
 *                                    ancestor with it. Also not "== <ref>" — REFUSED.
 *   NOT_EVALUABLE-PREMISE   exit 2  — <path> doesn't exist, isn't a git repo, has no working
 *                                    tree, or has no resolvable HEAD (unborn/empty repo). Never a
 *                                    stack trace — a one-line reason.
 *   NOT_EVALUABLE-NETWORK   exit 2  — the fetch (or the post-fetch ref resolution) failed: no
 *                                    such remote, unreachable, no such branch on the remote.
 *
 * Zero-dep: node: builtins + scripts/_git-env-lib.mjs only (site repo is zero-dep, SO #10). The
 * only subprocess form is `gitSync` (scrubbed env, GIT-ENV-LEAK-SWEEP-1) — no eval, no network
 * call outside the one `git fetch`, no npm.
 *
 * Paired self-test: scripts/assert-checkout-freshness.test.mjs (real fixture git repos — a local
 * bare "origin" plus clones/worktrees advanced or left behind it — run `node
 * scripts/assert-checkout-freshness.test.mjs`).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gitSync } from './_git-env-lib.mjs';

export const VERDICTS = Object.freeze({
  FRESH: 'FRESH',
  STALE: 'STALE',
  MISMATCH: 'MISMATCH',
  NOT_EVALUABLE_PREMISE: 'NOT_EVALUABLE-PREMISE',
  NOT_EVALUABLE_NETWORK: 'NOT_EVALUABLE-NETWORK',
});

function short(sha) {
  return sha ? sha.slice(0, 12) : sha;
}

// Thin wrapper over gitSync that normalizes a failure into a plain Error with a readable
// message (git's own stderr, trimmed) — the caller never sees a raw execFileSync stack.
function tryGit(args, cwd) {
  try {
    return gitSync(args, { cwd }).trim();
  } catch (e) {
    const stderr = e.stderr ? String(e.stderr).trim() : '';
    throw new Error(stderr || e.message);
  }
}

/**
 * Core check, exported for direct unit testing (no subprocess needed for most cases — see
 * the paired .test.mjs). Never throws: every failure mode resolves to a NOT_EVALUABLE-* verdict.
 *
 * @param {string} targetPath  git checkout to verify.
 * @param {{ref?: string}} opts  `ref` defaults to 'origin/main'.
 * @returns {{verdict:string, exitCode:number, detail:string, elapsedMs:number, path:string,
 *            ref:string, headSha?:string, tipSha?:string, headState?:string, ahead?:number,
 *            behind?:number}}
 */
export function assertFreshness(targetPath, { ref = 'origin/main' } = {}) {
  const t0 = Date.now();
  const base = { path: targetPath, ref };
  const finish = (verdict, exitCode, detail, extra = {}) =>
    ({ ...base, ...extra, verdict, exitCode, detail, elapsedMs: Date.now() - t0 });

  if (!existsSync(targetPath)) {
    return finish(VERDICTS.NOT_EVALUABLE_PREMISE, 2, `path does not exist: ${targetPath}`);
  }

  let isWorkTree;
  try {
    isWorkTree = tryGit(['rev-parse', '--is-inside-work-tree'], targetPath) === 'true';
  } catch (e) {
    return finish(VERDICTS.NOT_EVALUABLE_PREMISE, 2, `not a git repository at ${targetPath}: ${e.message}`);
  }
  if (!isWorkTree) {
    return finish(VERDICTS.NOT_EVALUABLE_PREMISE, 2, `${targetPath} has no working tree (bare repo, or not a repo)`);
  }

  let headSha;
  try {
    headSha = tryGit(['rev-parse', 'HEAD'], targetPath);
  } catch (e) {
    return finish(VERDICTS.NOT_EVALUABLE_PREMISE, 2, `HEAD unresolvable at ${targetPath} (unborn/empty repo?): ${e.message}`);
  }

  // Detached HEAD (worktrees included — SO #50: "which is where audits actually run") vs a
  // named local branch. symbolic-ref fails (no output) exactly when HEAD is detached.
  let headState;
  try {
    const branch = tryGit(['symbolic-ref', '-q', '--short', 'HEAD'], targetPath);
    headState = `branch:${branch}`;
  } catch {
    headState = `detached@${short(headSha)}`;
  }

  const slash = ref.indexOf('/');
  if (slash < 1 || slash === ref.length - 1) {
    return finish(VERDICTS.NOT_EVALUABLE_PREMISE, 2, `--ref must be of the form <remote>/<branch>, got '${ref}'`, { headSha, headState });
  }
  const remote = ref.slice(0, slash);
  const branchName = ref.slice(slash + 1);

  try {
    tryGit(['fetch', remote, branchName, '--quiet'], targetPath);
  } catch (e) {
    return finish(VERDICTS.NOT_EVALUABLE_NETWORK, 2, `git fetch ${remote} ${branchName} failed at ${targetPath}: ${e.message}`, { headSha, headState });
  }

  let tipSha;
  try {
    tipSha = tryGit(['rev-parse', ref], targetPath);
  } catch (e) {
    return finish(VERDICTS.NOT_EVALUABLE_NETWORK, 2, `${ref} unresolvable after fetch at ${targetPath}: ${e.message}`, { headSha, headState });
  }

  if (headSha === tipSha) {
    return finish(VERDICTS.FRESH, 0, `HEAD ${short(headSha)} == ${ref} ${short(tipSha)}`,
      { headSha, tipSha, headState, ahead: 0, behind: 0 });
  }

  let ahead = null;
  let behind = null;
  let divergeErr = null;
  try {
    const out = tryGit(['rev-list', '--left-right', '--count', `HEAD...${ref}`], targetPath);
    const parts = out.split(/\s+/).map(Number);
    [ahead, behind] = parts;
  } catch (e) {
    divergeErr = e.message;
  }

  if (ahead === null || Number.isNaN(ahead) || Number.isNaN(behind)) {
    return finish(VERDICTS.MISMATCH, 1,
      `HEAD ${short(headSha)} != ${ref} ${short(tipSha)}, and the commit relationship could not be computed (${divergeErr || 'unknown'}) — likely no common ancestor`,
      { headSha, tipSha, headState });
  }

  if (behind > 0 && ahead === 0) {
    return finish(VERDICTS.STALE, 1,
      `HEAD ${short(headSha)} is ${behind} commit${behind === 1 ? '' : 's'} behind ${ref} ${short(tipSha)}`,
      { headSha, tipSha, headState, ahead, behind });
  }
  if (ahead > 0 && behind === 0) {
    return finish(VERDICTS.MISMATCH, 1,
      `HEAD ${short(headSha)} is ${ahead} commit${ahead === 1 ? '' : 's'} ahead of ${ref} ${short(tipSha)} (local-only commits — not what "== ${ref}" means either)`,
      { headSha, tipSha, headState, ahead, behind });
  }
  return finish(VERDICTS.MISMATCH, 1,
    `HEAD ${short(headSha)} diverged from ${ref} ${short(tipSha)}: ${ahead} ahead / ${behind} behind`,
    { headSha, tipSha, headState, ahead, behind });
}

function formatLine(r) {
  const state = r.headState ? ` (head_state=${r.headState})` : '';
  const refusal = r.verdict === VERDICTS.FRESH ? '' : ' — REFUSED: do not use this checkout as audit/verification evidence (SO #48)';
  return `${r.verdict}: ${r.detail}${state}${refusal}`;
}

function printUsage() {
  console.error('usage: node scripts/assert-checkout-freshness.mjs [<path>] [--ref <remote>/<branch>]');
  console.error('  <path>  default: cwd     --ref  default: origin/main');
}

export function main(argv) {
  let target = null;
  let ref = 'origin/main';
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ref') { ref = argv[++i]; }
    else if (a === '--help' || a === '-h') { printUsage(); return 0; }
    else if (!String(a).startsWith('--') && target === null) { target = a; }
    else {
      console.log(`${VERDICTS.NOT_EVALUABLE_PREMISE}: unknown argument '${a}'`);
      printUsage();
      return 2;
    }
  }
  const resolvedTarget = resolve(target ?? process.cwd());
  let r;
  try {
    r = assertFreshness(resolvedTarget, { ref });
  } catch (e) {
    // Belt-and-suspenders: assertFreshness() is designed to never throw, but an unforeseen
    // failure still resolves to the NOT_EVALUABLE-PREMISE shape, never a raw stack trace.
    console.log(`${VERDICTS.NOT_EVALUABLE_PREMISE}: unexpected failure evaluating ${resolvedTarget}: ${e.message}`);
    console.log('elapsed_ms=0');
    return 2;
  }
  console.log(formatLine(r));
  console.log(`elapsed_ms=${r.elapsedMs}`);
  return r.exitCode;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exitCode = main(process.argv);
}

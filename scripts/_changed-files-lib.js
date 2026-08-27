#!/usr/bin/env node
// scripts/_changed-files-lib.js — shared `--changed <REF>` diff-scoping helper.
//
// PREREQ-CHANGED-SCOPING-1 (0xAlpha/audits/GATE-MANIFEST-DRAFT.md §3 PREREQ-3):
// the ONE incremental-diff mechanism reused by every builder gate that scopes
// to the diff (B2/B5/B6/B7). Ports scripts/verify_repo.py's
// get_changed_files()/_touched() pattern to Node verbatim — union of the
// committed diff vs REF, the uncommitted diff vs HEAD, and the working-tree
// status (git status --porcelain) — so a file that is staged, dirty, or
// merely reverted-in-place is treated as "changed" exactly the way
// verify_repo.py already does. Do NOT write a second copy of this logic
// anywhere else (SANDBOX-FILELIST-GATE-1 is the defect this avoids: no
// hand-maintained file lists, one generator/helper).
//
// CommonJS on purpose: scripts/check_tools.js is CJS (`require`) and every
// other consumer is ESM (`.mjs`), which can `import` a CJS module's named
// exports directly — one file serves both without a second port.
//
// Every git child goes through scripts/_git-env-lib.mjs's gitSync/gitEnv
// (GIT-ENV-LEAK-SWEEP-1, SO #57) — never a raw execFileSync('git', ...) —
// so this helper answers about the REPO at `cwd`, never an ambient
// GIT_DIR/GIT_WORK_TREE a pre-push hook exported into this process. _git-
// env-lib.mjs is ESM; Node 22.12+'s synchronous require(esm) loads it from
// this CJS file directly, no second scrub, no async split.
'use strict';

const path = require('node:path');
const { gitSync } = require('./_git-env-lib.mjs');

const REPO = path.resolve(__dirname, '..');

/**
 * Union of files touched vs <ref> (committed) and in the working tree
 * (uncommitted), as repo-relative forward-slash paths.
 * Returns null when the diff is UNDETERMINABLE — no git on PATH, <ref> does
 * not resolve, or any of the three git commands fails — mirroring
 * verify_repo.py's get_changed_files() returning None under the identical
 * conditions ("falling back to full scan").
 */
function getChangedFiles(ref, { repo = REPO } = {}) {
  try {
    gitSync(['rev-parse', '--verify', ref], { cwd: repo });
  } catch {
    return null; // ref not resolvable, or git itself unavailable
  }
  const changed = new Set();
  const cmds = [
    ['diff', '--name-only', `${ref}...HEAD`],
    ['diff', '--name-only', 'HEAD'],
    ['status', '--porcelain'],
  ];
  for (const cmd of cmds) {
    let out;
    try {
      out = gitSync(cmd, { cwd: repo });
    } catch {
      return null; // any of the three failing is undeterminable, same as verify_repo.py
    }
    for (const rawLine of out.split('\n')) {
      if (!rawLine) continue;
      // `git status --porcelain` prefixes each line with a fixed-width 2-char
      // status code + space (e.g. " M path", "?? path") — slice the RAW line
      // BEFORE trimming. The porcelain status's first column is a literal
      // space for "modified/deleted in worktree, not staged" (the single most
      // common state), so trimming first collapses that leading space and
      // throws off the fixed 3-char offset, corrupting the path (this is a
      // real bug ported straight out of verify_repo.py's identical
      // strip-then-slice order — fixed here rather than propagated. It was
      // latent there and here: an unstaged " M"/" D" file is already caught
      // by `git diff --name-only HEAD` above, so the corrupted duplicate
      // never masked a real touched file — worth fixing anyway).
      const line = (cmd[0] === 'status' ? rawLine.slice(3) : rawLine).trim();
      if (!line) continue;
      changed.add(line.replace(/\\/g, '/'));
    }
  }
  return changed;
}

/** True iff relPath (any path separator) is in the changed set. */
function isTouched(relPath, changed) {
  return changed.has(relPath.replace(/\\/g, '/'));
}

/**
 * Resolve the --changed <REF> scope for a gate, applying PREREQ-3's
 * ASYMMETRIC undeterminable-diff rule — there is no gate where undeterminable
 * silently means "pass":
 *   failClosed: true  -> B1/B2/B5 group: undeterminable diff = BLOCK (exit 1).
 *   failClosed: false -> B6/B7 group: undeterminable diff = fall back to a
 *                         full scan (safe-by-cost), exactly like plain no
 *                         --changed.
 * Returns:
 *   null        -> no scoping requested, or scoping collapsed to a full scan
 *                  (the fail-open case) — caller scans everything.
 *   Set<string> -> scoping is active; caller filters to these paths only.
 */
function resolveChangedScope(ref, { gate, failClosed }) {
  if (!ref) return null;
  const changed = getChangedFiles(ref);
  if (changed === null) {
    if (failClosed) {
      console.error(`${gate}: --changed ${ref} — diff UNDETERMINABLE (git unavailable, or "${ref}" does not resolve). This gate fails CLOSED on an unknown scope (PREREQ-3): BLOCKED. Re-run without --changed for a full scan, or fix the ref.`);
      process.exit(1);
    }
    console.log(`${gate}: --changed ${ref} — diff UNDETERMINABLE, falling back to a FULL scan (PREREQ-3 fail-open, safe-by-cost).`);
    return null;
  }
  return changed;
}

module.exports = { REPO, getChangedFiles, isTouched, resolveChangedScope };

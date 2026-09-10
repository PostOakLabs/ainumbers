#!/usr/bin/env node
// scripts/_walk-skip-dirs.mjs — shared skip-list for scripts that recursively
// walk the repo tree for HTML/asset discovery (WT-IGNORE-GATES-1, item c).
//
// hy4-workbuddy-audit-2026-08-29.md P0-2: dead-link-check.mjs's own SKIP_DIRS
// listed '.git','node_modules','.github','worktrees' but not '.wt' — the local
// per-WU worktree directory (board/STANDING-ORDERS.md) — so a recursive walker
// read ~31,663 foreign-checkout HTML files (95% of its scan) on every run.
// check-copy-hallmarks.mjs had independently patched its own copy to add
// '.wt' (line 390, pre-existing), so the same exclusion existed twice and had
// already drifted once. This is the ONE place it lives now.
//
// A worktree checkout is ALWAYS either a literal `worktrees/` subdir (legacy
// convention, still real: `.claude/worktrees/*`) or a dot-prefixed directory
// at the walk root (`.wt/*`, `.worktrees/*`, `.git/worktrees/*` — never walked
// past `.git` itself, but caught here too). Skipping every dot-directory
// except `.well-known` (the one dot-dir that is genuinely published content)
// covers all of those by construction instead of enumerating each convention
// by name, so a future worktree location never needs a fourth copy of this
// list — it just needs to start with a dot.
const SKIP_DIR_NAMES = new Set(['node_modules', 'worktrees']);

/** @param {string} name a single path segment (directory basename), not a path */
export function isSkipDir(name) {
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (name.startsWith('.') && name !== '.well-known') return true;
  return false;
}

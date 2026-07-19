#!/usr/bin/env node
/**
 * scripts/check-protected-paths.mjs — normative-surface guard.
 *
 * CONTRACT.md, chaingraph/standard/SPEC.md,
 * chaingraph/standard/openchain-graph-v0.4.schema.json, and the guard's own
 * two enforcement files are FLAG-AND-WAIT — Tim's escalation policy says a
 * WU session does not change them without asking.
 *
 * INFORMATIONAL ONLY (GUARD-LABEL-DROP-1, 2026-07-19 — corrects the prior
 * blocking design). This script never exits nonzero for a protected-path
 * touch, in any mode. The real enforcement is CODEOWNERS-required-review on
 * these paths (`.github/CODEOWNERS` + branch protection) — a PR touching
 * them cannot merge without Tim's review regardless of what this script
 * prints. A PR-mode "block, then re-open via a label" step was tried first
 * (CONTRACT-GUARD-1 → GUARD-COVER-1 → GUARD-TRIGGER-1 → GUARD-SELF-1/2) and
 * DROPPED THE SAME NIGHT it started actually firing: Tim was clicking
 * `protected-edit-approved` on every guarded PR with no judgment behind the
 * click (he already has to review the diff to merge — CODEOWNERS forces
 * that), so the label added a second rubber-stamp on top of the real gate,
 * not a second independent check. A gate that always says yes to whoever
 * already has to approve it isn't a gate — it's a wasted click. Removing it
 * loses nothing: CODEOWNERS review is still the exact same required,
 * enforced, un-bypassable control it always was. This script's remaining
 * job is visibility — name the touched path(s) loudly so a reviewer isn't
 * relying on memory to notice.
 *
 * Any infra failure (ref won't resolve, fetch fails) is reported and still
 * exits 0 — an unevaluable guard must never block a push or a merge; it
 * isn't the enforcement layer.
 *
 * Compares the working tree (staged + unstaged) against origin/main.
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP, no npm ever).
 *
 * Usage: node scripts/check-protected-paths.mjs
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PROTECTED_PATHS = [
  'CONTRACT.md',
  'chaingraph/standard/SPEC.md',
  'chaingraph/standard/openchain-graph-v0.4.schema.json',
  '.github/workflows/protected-paths.yml',
  'scripts/check-protected-paths.mjs',
];

function refExists(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { cwd: REPO, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function warnUnevaluable(reason) {
  console.error(`check-protected-paths: could not evaluate the guard — ${reason}`);
  console.error('check-protected-paths: WARNING — unable to tell whether a protected path changed.');
  console.error('check-protected-paths: exiting 0 regardless — this script is informational, not the merge gate.');
  console.error('check-protected-paths: CODEOWNERS-required-review on the protected paths is the real control.');
  process.exit(0);
}

// Local clones (worktrees, pre-push hook) have a full history and origin/main
// already exists. CI's actions/checkout is fetch-depth:1 on the head ref
// only — origin/main isn't there, so fetch it (git fetch is a plain git
// operation, not a new Action). GITHUB_BASE_REF names the PR's base branch;
// fall back to 'main' for the push-to-main trigger, where it self-diffs to
// empty (correct — that gate matters pre-merge, not post-merge).
function resolveDiffTarget() {
  if (refExists('origin/main')) return 'origin/main';

  const base = process.env.GITHUB_BASE_REF || 'main';
  try {
    execSync(`git fetch --depth=1 origin ${base}`, { cwd: REPO, stdio: 'ignore' });
    return 'FETCH_HEAD';
  } catch (e) {
    warnUnevaluable(`could not fetch origin/${base} to diff against — ${(e.stderr?.toString() || e.message || '').trim()}`);
  }
}

function changedFiles() {
  const target = resolveDiffTarget();
  try {
    const out = execSync(`git diff --name-only ${target}`, { cwd: REPO, encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) {
    warnUnevaluable(`could not diff against ${target} — ${(e.stderr?.toString() || e.message || '').trim()}`);
    return [];
  }
}

const changed = changedFiles();
const hits = PROTECTED_PATHS.filter(p => changed.includes(p));

if (hits.length === 0) {
  console.log('check-protected-paths: OK — no normative surface touched.');
  process.exit(0);
}

console.warn('check-protected-paths: ⚠️  NOTICE — normative surface modified: ' + hits.join(', '));
console.warn('');
console.warn('  These paths are FLAG-AND-WAIT (workspace CLAUDE.md escalation policy).');
console.warn('  This is informational only — it does not block. Merge is gated by');
console.warn('  CODEOWNERS-required-review on these paths (see .github/CODEOWNERS),');
console.warn('  which is the actual enforced control.');
process.exit(0);

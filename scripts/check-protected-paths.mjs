#!/usr/bin/env node
/**
 * scripts/check-protected-paths.mjs — normative-surface guard.
 *
 * CONTRACT.md, chaingraph/standard/SPEC.md, and
 * chaingraph/standard/openchain-graph-v0.4.schema.json are FLAG-AND-WAIT —
 * Tim's escalation policy says a WU session does not change them without
 * asking. That policy is prose; this gate is the enforcement (CONTRACT-GUARD-1).
 *
 * Three modes (Tim, 2026-07-18 — a broken ref-resolution path hard-failed a
 * local push; local hooks must be ADVISORY, blocking belongs SERVER-SIDE):
 *   1. DEFAULT (local preflight, push-to-main, anything not a PR) — print a
 *      loud warning naming the touched path(s) and exit 0. Never blocks.
 *   2. CI PULL-REQUEST CONTEXT (GITHUB_EVENT_NAME === 'pull_request') — block,
 *      exit 1, as before. This is the half that actually enforces.
 *   3. ALLOW_PROTECTED_EDIT=1 — bypass, in either mode, for a Tim-approved
 *      change. Must be a deliberate, visible act, never a reflex.
 *
 * Any infra failure (ref won't resolve, fetch fails) is NOT a policy verdict.
 * In DEFAULT/override mode it fails OPEN — exit 0 with a warning — since
 * enforcement is server-side and a local infra gap must never block a push.
 * In PR mode it fails CLOSED — exit 1 — since PR mode is the only enforcing
 * mode: an unevaluable guard there must block, not silently pass through.
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
const IS_PR = process.env.GITHUB_EVENT_NAME === 'pull_request';

const PROTECTED_PATHS = [
  'CONTRACT.md',
  'chaingraph/standard/SPEC.md',
  'chaingraph/standard/openchain-graph-v0.4.schema.json',
];

function refExists(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { cwd: REPO, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function failOpen(reason) {
  console.error(`check-protected-paths: could not evaluate the guard — ${reason}`);
  console.error('check-protected-paths: WARNING — unable to tell whether a protected path changed.');
  if (IS_PR) {
    console.error('check-protected-paths: in PR context an unevaluable guard blocks; re-run the check.');
    console.error('check-protected-paths: failing CLOSED (exit 1).');
    process.exit(1);
  }
  console.error('check-protected-paths: failing OPEN (exit 0). This is an infra gap, not a policy pass.');
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
    failOpen(`could not fetch origin/${base} to diff against — ${(e.stderr?.toString() || e.message || '').trim()}`);
  }
}

function changedFiles() {
  const target = resolveDiffTarget();
  try {
    const out = execSync(`git diff --name-only ${target}`, { cwd: REPO, encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) {
    failOpen(`could not diff against ${target} — ${(e.stderr?.toString() || e.message || '').trim()}`);
    return [];
  }
}

const changed = changedFiles();
const hits = PROTECTED_PATHS.filter(p => changed.includes(p));

if (hits.length === 0) {
  console.log('check-protected-paths: OK — no normative surface touched.');
  process.exit(0);
}

if (process.env.ALLOW_PROTECTED_EDIT === '1') {
  console.log(`check-protected-paths: OVERRIDE — ALLOW_PROTECTED_EDIT=1 set. Allowing edit to: ${hits.join(', ')}`);
  console.log('check-protected-paths: confirm Tim actually approved this before pushing.');
  process.exit(0);
}

if (IS_PR) {
  console.error('check-protected-paths: FAILED — normative surface modified without approval.');
  console.error('');
  console.error('  Modified: ' + hits.join(', '));
  console.error('');
  console.error('  These paths are FLAG-AND-WAIT (workspace CLAUDE.md escalation policy).');
  console.error('  STOP. Ask Tim before changing CONTRACT.md, SPEC.md, or the v0.4 schema.');
  console.error('');
  console.error('  If Tim has ALREADY approved this change, re-run with the override:');
  console.error('    ALLOW_PROTECTED_EDIT=1 node scripts/check-protected-paths.mjs');
  console.error('  (PowerShell: $env:ALLOW_PROTECTED_EDIT=1; node scripts/check-protected-paths.mjs)');
  process.exit(1);
}

console.warn('check-protected-paths: ⚠️  WARNING — normative surface modified: ' + hits.join(', '));
console.warn('');
console.warn('  These paths are FLAG-AND-WAIT (workspace CLAUDE.md escalation policy).');
console.warn('  STOP AND ASK TIM before this reaches a PR — it will be BLOCKED there.');
console.warn('');
console.warn('  This is a WARNING ONLY. The push is proceeding (exit 0) — enforcement');
console.warn('  happens server-side, on the PR.');
console.warn('');
console.warn('  If Tim has ALREADY approved this change, silence this warning with:');
console.warn('    ALLOW_PROTECTED_EDIT=1 node scripts/check-protected-paths.mjs');
console.warn('  (PowerShell: $env:ALLOW_PROTECTED_EDIT=1; node scripts/check-protected-paths.mjs)');
process.exit(0);

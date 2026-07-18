#!/usr/bin/env node
/**
 * scripts/check-protected-paths.mjs — normative-surface guard.
 *
 * CONTRACT.md, chaingraph/standard/SPEC.md, and
 * chaingraph/standard/openchain-graph-v0.4.schema.json are FLAG-AND-WAIT —
 * Tim's escalation policy says a WU session does not change them without
 * asking. That policy is prose; this gate is the enforcement (CONTRACT-GUARD-1).
 *
 * Compares the working tree (staged + unstaged) against origin/main. Exits
 * non-zero if any protected path differs.
 *
 * Escape hatch: if Tim HAS approved a change, set ALLOW_PROTECTED_EDIT=1 to
 * bypass. This must be a deliberate, visible act, never a reflex.
 *
 * Zero-dep, node: builtins only (site repo is ZERO-DEP, no npm ever).
 *
 * Usage: node scripts/check-protected-paths.mjs
 * Exit 0 = no protected path touched (or override set).
 * Exit 1 = a protected path was modified and no override is set.
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
    console.error(`check-protected-paths: could not fetch origin/${base} to diff against.`);
    console.error((e.stderr?.toString() || e.message || '').trim());
    process.exit(1);
  }
}

function changedFiles() {
  const target = resolveDiffTarget();
  try {
    const out = execSync(`git diff --name-only ${target}`, { cwd: REPO, encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) {
    console.error(`check-protected-paths: could not diff against ${target}.`);
    console.error((e.stderr?.toString() || e.message || '').trim());
    process.exit(1);
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

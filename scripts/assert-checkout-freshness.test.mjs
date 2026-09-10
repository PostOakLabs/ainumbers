#!/usr/bin/env node
/**
 * scripts/assert-checkout-freshness.test.mjs — paired self-test for
 * scripts/assert-checkout-freshness.mjs (AUDIT-FRESHNESS-ASSERT-1).
 *
 * Proves the row's four required surfaces, each against a REAL git fixture (no mocking of git
 * itself — only the environment each fixture `git` child receives is controlled, per SO #57 /
 * GIT-ENV-LEAK-SWEEP-1, via `isolatedChildEnv()`):
 *   1. GREEN  (FRESH)                — a clone at the same commit as its origin.
 *   2. RED    (STALE)                — origin advances after the clone was made; names the drift.
 *   3. RED    (MISMATCH, ahead)      — the clone advances locally without pushing.
 *   4. RED    (MISMATCH, diverged)   — both sides advance independently.
 *   5. DETACHED / WORKTREE           — `git worktree add --detach`, which is where an audit
 *                                      session actually runs (SO #50) — still evaluates correctly
 *                                      and reports `head_state=detached@<sha>`.
 *   6. NOT-A-REPO                    — a plain directory with no `.git`, fails CLEANLY (no stack
 *                                      trace in the printed line).
 *   7. Nonexistent path, and a malformed `--ref` — both also NOT_EVALUABLE-PREMISE.
 *   8. CLI end-to-end (subprocess)   — the actual printed line + `elapsed_ms=` line + exit code,
 *                                      not just the exported function.
 *
 * Deterministic and network-free: "origin" is a local bare repo; `git fetch` against a local
 * path performs no network I/O, so this is genuinely a live git operation, not a simulation.
 *
 * Usage: node scripts/assert-checkout-freshness.test.mjs
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gitSync, isolatedChildEnv } from './_git-env-lib.mjs';
import { assertFreshness, VERDICTS } from './assert-checkout-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'assert-checkout-freshness.mjs');

const failures = [];
function assert(cond, label) {
  if (cond) {
    console.log(`  PASS: ${label}`);
  } else {
    console.log(`  FAIL: ${label}`);
    failures.push(label);
  }
}

// A committer identity forced via env on every fixture git child (isolatedChildEnv's allowlist
// deliberately excludes GIT_*, so this is the ONLY way a fixture commit gets an identity —
// exactly the "extra applied last" escape hatch _git-env-lib.mjs documents).
const IDENTITY = {
  GIT_AUTHOR_NAME: 'AFA Fixture', GIT_AUTHOR_EMAIL: 'afa-fixture@example.invalid',
  GIT_COMMITTER_NAME: 'AFA Fixture', GIT_COMMITTER_EMAIL: 'afa-fixture@example.invalid',
};

function fgit(args, cwd) {
  return gitSync(args, { cwd, env: isolatedChildEnv(IDENTITY) });
}

function writeAndCommit(dir, filename, contents, message) {
  writeFileSync(join(dir, filename), contents);
  fgit(['add', '.'], dir);
  fgit(['commit', '-m', message, '--quiet'], dir);
}

/** Bare "origin" + a non-bare "seed" clone used to push new commits into it. */
function makeOrigin(root) {
  const origin = join(root, 'origin.git');
  const seed = join(root, 'seed');
  fgit(['init', '--quiet', '--bare', '-b', 'main', origin]);
  fgit(['init', '--quiet', '-b', 'main', seed]);
  writeAndCommit(seed, 'file.txt', 'v1\n', 'initial commit');
  fgit(['remote', 'add', 'origin', origin], seed);
  fgit(['push', '--quiet', 'origin', 'main'], seed);
  return { origin, seed };
}

function cloneFrom(origin, dest) {
  fgit(['clone', '--quiet', origin, dest]);
  return dest;
}

function advanceAndPush(seed, n, tag) {
  for (let i = 0; i < n; i++) {
    writeAndCommit(seed, `${tag}-${i}.txt`, `${tag} ${i}\n`, `${tag} commit ${i}`);
  }
  fgit(['push', '--quiet', 'origin', 'main'], seed);
}

function tmp(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

const noStackTrace = (s) => !/\n\s*at [A-Za-z]/.test(s) && !/^Error:\s*$/m.test(s);

// ---------------------------------------------------------------------------------------------
console.log('Case 1 — FRESH: a clone at the same commit as its origin.');
{
  const root = tmp('afa-fresh-');
  const { origin } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));
  const r = assertFreshness(clone, { ref: 'origin/main' });
  console.log(`  result: ${JSON.stringify(r)}`);
  assert(r.verdict === VERDICTS.FRESH, 'verdict is FRESH');
  assert(r.exitCode === 0, 'exit code 0');
  assert(r.headSha === r.tipSha, 'HEAD equals origin/main tip');
  assert(typeof r.elapsedMs === 'number' && r.elapsedMs >= 0, 'elapsedMs is a non-negative number');
  assert(r.elapsedMs < 5000, `elapsedMs (${r.elapsedMs}) under the 5s target`);
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 2 — STALE: origin advances 3 commits after the clone was made.');
{
  const root = tmp('afa-stale-');
  const { origin, seed } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));
  advanceAndPush(seed, 3, 'advance');
  const r = assertFreshness(clone, { ref: 'origin/main' });
  console.log(`  result: ${JSON.stringify(r)}`);
  assert(r.verdict === VERDICTS.STALE, 'verdict is STALE');
  assert(r.exitCode === 1, 'exit code 1 (refused)');
  assert(r.behind === 3, `behind === 3 (got ${r.behind})`);
  assert(r.ahead === 0, 'ahead === 0');
  assert(r.detail.includes('3 commits behind'), 'detail names the exact drift (3 commits behind)');
  assert(r.headSha !== r.tipSha, 'HEAD SHA differs from tip SHA — both quotable');
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 3 — MISMATCH (ahead): the clone advances locally without pushing.');
{
  const root = tmp('afa-ahead-');
  const { origin } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));
  writeAndCommit(clone, 'local-only.txt', 'local\n', 'unpushed local commit');
  const r = assertFreshness(clone, { ref: 'origin/main' });
  console.log(`  result: ${JSON.stringify(r)}`);
  assert(r.verdict === VERDICTS.MISMATCH, 'verdict is MISMATCH');
  assert(r.exitCode === 1, 'exit code 1 (refused)');
  assert(r.ahead === 1 && r.behind === 0, `ahead=1/behind=0 (got ahead=${r.ahead} behind=${r.behind})`);
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 4 — MISMATCH (diverged): both sides advance independently.');
{
  const root = tmp('afa-diverge-');
  const { origin, seed } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));
  writeAndCommit(clone, 'local-only.txt', 'local\n', 'unpushed local commit');
  advanceAndPush(seed, 2, 'remote-advance');
  const r = assertFreshness(clone, { ref: 'origin/main' });
  console.log(`  result: ${JSON.stringify(r)}`);
  assert(r.verdict === VERDICTS.MISMATCH, 'verdict is MISMATCH');
  assert(r.exitCode === 1, 'exit code 1 (refused)');
  assert(r.ahead === 1 && r.behind === 2, `ahead=1/behind=2 (got ahead=${r.ahead} behind=${r.behind})`);
  assert(r.detail.includes('diverged'), 'detail names it as diverged');
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 5 — DETACHED / WORKTREE: git worktree add --detach, where an audit actually runs.');
{
  const root = tmp('afa-detached-');
  const { origin } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));
  const headSha = fgit(['rev-parse', 'HEAD'], clone).trim();
  const wt = join(root, 'detached-wt');
  fgit(['worktree', 'add', '--detach', '--quiet', wt, headSha], clone);
  const r = assertFreshness(wt, { ref: 'origin/main' });
  console.log(`  result: ${JSON.stringify(r)}`);
  assert(r.verdict === VERDICTS.FRESH, 'a detached worktree at the tip still evaluates FRESH');
  assert(r.headState === `detached@${headSha.slice(0, 12)}`, `head_state correctly reports detached@sha (got ${r.headState})`);
  fgit(['worktree', 'remove', '--force', wt], clone);
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 6 — NOT-A-REPO: a plain directory with no .git fails cleanly, never a stack trace.');
{
  const root = tmp('afa-notrepo-');
  const r = assertFreshness(root, { ref: 'origin/main' });
  console.log(`  result: ${JSON.stringify(r)}`);
  assert(r.verdict === VERDICTS.NOT_EVALUABLE_PREMISE, 'verdict is NOT_EVALUABLE-PREMISE');
  assert(r.exitCode === 2, 'exit code 2 (environment/premise, distinct from a drift refusal)');
  assert(noStackTrace(r.detail), 'detail carries no JS stack-trace fragment');
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 7 — nonexistent path, and a malformed --ref: both NOT_EVALUABLE-PREMISE.');
{
  const root = tmp('afa-parent-');
  const missing = join(root, 'does-not-exist');
  const r1 = assertFreshness(missing, { ref: 'origin/main' });
  console.log(`  result (missing path): ${JSON.stringify(r1)}`);
  assert(r1.verdict === VERDICTS.NOT_EVALUABLE_PREMISE, 'nonexistent path is NOT_EVALUABLE-PREMISE');
  assert(r1.exitCode === 2, 'exit code 2');

  const { origin } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));
  const r2 = assertFreshness(clone, { ref: 'main' }); // no '<remote>/' prefix
  console.log(`  result (bad --ref): ${JSON.stringify(r2)}`);
  assert(r2.verdict === VERDICTS.NOT_EVALUABLE_PREMISE, 'malformed --ref is NOT_EVALUABLE-PREMISE');
  assert(noStackTrace(r2.detail), 'malformed-ref detail carries no stack trace');
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('Case 8 — CLI end-to-end (subprocess): printed line + elapsed_ms line + exit code.');
{
  const root = tmp('afa-cli-');
  const { origin, seed } = makeOrigin(root);
  const clone = cloneFrom(origin, join(root, 'clone'));

  const runCli = (args) => {
    try {
      const out = execFileSync('node', [SCRIPT, ...args], {
        cwd: root, encoding: 'utf8', env: isolatedChildEnv(),
      });
      return { out, code: 0 };
    } catch (e) {
      return { out: (e.stdout || '') + (e.stderr || ''), code: e.status };
    }
  };

  const fresh = runCli([clone]);
  console.log(`  FRESH run:\n${fresh.out.trim().split('\n').map((l) => '    ' + l).join('\n')}`);
  assert(fresh.code === 0, 'CLI exit code 0 on FRESH');
  assert(/^FRESH: /.test(fresh.out), 'CLI stdout starts with FRESH: ');
  assert(/elapsed_ms=\d+/.test(fresh.out), 'CLI stdout carries an elapsed_ms=<n> line');

  advanceAndPush(seed, 2, 'cli-advance');
  const stale = runCli([clone]);
  console.log(`  STALE run:\n${stale.out.trim().split('\n').map((l) => '    ' + l).join('\n')}`);
  assert(stale.code === 1, 'CLI exit code 1 on STALE (refused)');
  assert(/^STALE: /.test(stale.out), 'CLI stdout starts with STALE: ');
  assert(stale.out.includes('2 commits behind'), 'CLI stdout names the exact drift');
  assert(stale.out.includes('REFUSED'), 'CLI stdout carries the REFUSED marker');

  const notARepo = runCli([join(root, 'nope')]);
  console.log(`  NOT-A-REPO run:\n${notARepo.out.trim().split('\n').map((l) => '    ' + l).join('\n')}`);
  assert(notARepo.code === 2, 'CLI exit code 2 on a missing path');
  assert(/^NOT_EVALUABLE-PREMISE: /.test(notARepo.out), 'CLI stdout starts with NOT_EVALUABLE-PREMISE: ');
  assert(noStackTrace(notARepo.out), 'CLI stdout carries no stack trace on the premise failure');

  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S): ${failures.join('; ')}`);
  process.exit(1);
}
console.log('\nAll assert-checkout-freshness.mjs fixtures pass.');
process.exit(0);

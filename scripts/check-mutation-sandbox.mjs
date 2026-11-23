#!/usr/bin/env node
/**
 * scripts/check-mutation-sandbox.mjs — MUTATION-TIER-SANDBOX-PREFLIGHT-1.
 *
 * Local, Stryker-free preflight for the mutation tier's scratch sandbox.
 * PR #3238 hard-failed CI "Mutation tier leg" because the 808 proptest read
 * chaingraph/808-lst-share-rate-reconciler.html, which copySandboxDeps never
 * copies into os.tmpdir()/ain-mutation-tier-<pid>: Stryker saw ENOENT, wrote
 * no report.json, and the tier recorded a HARD FAIL. That whole class (a
 * proptest or kernel that reads a file the sandbox lacks) is visible without
 * Stryker by running the proptest once from the sandbox copy.
 *
 * Usage:
 *   node scripts/check-mutation-sandbox.mjs --kernel <id> [<id> ...]
 *       [--repo-root <dir>]   build the sandbox from another tree (e.g. a
 *                             `git archive` copy of an older commit)
 *
 * For each kernel id this builds the SAME sandbox the tier builds
 * (copySandboxDeps from run-mutation-tier.mjs) and runs
 * `node chaingraph/kernels/__proptests__/<id>.proptest.mjs` there with plain
 * node, twice: with __STRYKER_ACTIVE_MUTANT__ unset, then set (the two modes
 * proptests detect). It never spawns npx or Stryker (self-test asserts this).
 *
 * Exit 0 — every kernel's proptest passed in both modes.
 * Exit 1 — the first failing kernel/mode and its first error line (an ENOENT
 *          path included) are printed; later kernels still run and report.
 *
 * NOT wired into preflight (a follow-up row decides that).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copySandboxDeps } from './run-mutation-tier.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The only process this tool ever runs: the proptest, under the current node. */
export function defaultRun(args, cwd, env) {
  const r = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', timeout: 300000 });
  return { status: r.status, output: `${r.stdout || ''}${r.stderr || ''}`, error: r.error ? String(r.error.message) : null };
}

/** First informative error line: prefer an ENOENT/Error line over stack frames. */
export function firstError(output, error) {
  const lines = String(output || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => /ENOENT|ERR_MODULE_NOT_FOUND|Error/.test(l)) || lines[0] || error || 'no output';
}

export function checkKernels(ids, { repoRoot = REPO, run = defaultRun } = {}) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'ain-mutation-sandbox-preflight-'));
  const failures = [];
  try {
    for (const id of ids) {
      try {
        copySandboxDeps(
          `chaingraph/kernels/${id}.kernel.mjs`,
          `chaingraph/kernels/__proptests__/${id}.proptest.mjs`,
          `chaingraph/kernels/fixtures/${id}.fixtures.json`,
          scratch,
          repoRoot,
        );
      } catch (e) {
        failures.push({ id, mode: 'sandbox-build', error: e.message });
        continue;
      }
      const script = `chaingraph/kernels/__proptests__/${id}.proptest.mjs`;
      const baseEnv = { ...process.env };
      delete baseEnv.__STRYKER_ACTIVE_MUTANT__;
      for (const [mode, env] of [['unset', baseEnv], ['set', { ...baseEnv, __STRYKER_ACTIVE_MUTANT__: '0' }]]) {
        const r = run([script], scratch, env);
        if (r.status !== 0) {
          failures.push({ id, mode: `__STRYKER_ACTIVE_MUTANT__ ${mode}`, error: firstError(r.output, r.error) });
          break; // first error per kernel is enough
        }
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return failures;
}

function main(argv) {
  const ids = [];
  let repoRoot = REPO;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kernel') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) ids.push(argv[++i]); }
    else if (argv[i] === '--repo-root') repoRoot = path.resolve(argv[++i]);
  }
  if (ids.length === 0) { console.error('usage: check-mutation-sandbox.mjs --kernel <id> [<id> ...] [--repo-root <dir>]'); return 2; }
  const failures = checkKernels(ids, { repoRoot });
  for (const f of failures) console.error(`MUTATION-SANDBOX FAIL ${f.id} (${f.mode}): ${f.error}`);
  if (failures.length === 0) console.log(`MUTATION-SANDBOX OK: ${ids.length} kernel(s), proptest passes from the sandbox copy in both modes`);
  return failures.length ? 1 : 0;
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) process.exit(main(process.argv.slice(2)));

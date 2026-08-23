#!/usr/bin/env node
/**
 * scripts/run-gate.mjs — single source of the PR-advisory / main-blocking split
 * for shared-derived-artifact freshness gates (SO #35, LAND-VERIFY-ADVISORY-SPLIT-1).
 *
 * WHY: `preflight.mjs` already applies this split inline (isMainContext() +
 * advisoryGates() from derived-artifacts.mjs, the SSOT of which gate commands
 * are advisory on a PR). html-verify.yml's nav-island-baseline step hand-rolled
 * the same shape a second time. land-verify.yml's count-drift step didn't have
 * it at all, so a PR that legitimately moves published counts (e.g. a prove
 * batch changing §18 counts) went hard-red on a gate it is FORBIDDEN by SO #35
 * to satisfy — every prove/land PR became unmergeable once REQUIRED-CHECKS-
 * ENFORCE-1 made land-verify/required a blocking status check.
 *
 * This wrapper is the ONE place the split lives for CI workflow steps, so
 * check-workflow-gate-parity.mjs can assert every derived gate in every
 * workflow goes through it instead of re-deriving the logic per file.
 *
 * ⛔ NO CHECK IS EVER SKIPPED. The wrapped command always RUNS and its full
 * output always prints; only the exit-code handling differs by context.
 *
 * Usage: node scripts/run-gate.mjs <command...>
 *   e.g. node scripts/run-gate.mjs node scripts/verify-counts.mjs --check
 *
 * ⚠ MERGEQUEUE-GATE-PARITY-1 (2026-08-23) — CORRECTION OF A LOAD-BEARING CLAIM.
 * This file's caller (land-verify.yml) documented isMainContext() as treating
 * `merge_group` as a MAIN context. It does not, and never did:
 * derived-artifacts.mjs:672-675 returns FALSE for `merge_group`, exactly as for
 * `pull_request`. Measured:
 *     GITHUB_EVENT_NAME=push -> main      GITHUB_EVENT_NAME=merge_group -> pr
 * That behaviour is deliberate and STAYS — a queued PR still cannot regenerate a
 * single-writer artifact, so SO #35's argument applies inside the queue too. But
 * it means this downgrade fires on the very commit about to become main, so it
 * has to be EARNED rather than assumed: check-regen-repairable.mjs re-derives, in
 * a throwaway worktree, that the main-side regen actually erases this drift. If
 * it cannot, the drift survives the merge and reds main, so it blocks here in
 * every context. See that file's header for the measured incident — five
 * same-SHA `merge_group / success` + `push / failure` pairs in one morning.
 *
 * Exit 0  — command passed, OR command failed but is in advisoryGates(),
 *           isMainContext() is false, AND the drift is provably repairable by
 *           the main-side regen (PR/queue context: warn, don't block).
 * Exit 1+ — command failed and either isMainContext() is true (push to main:
 *           block), or the command is not a recognised advisory gate, or the
 *           drift is NOT repairable by the main-side regen.
 */
import { execSync } from 'node:child_process';
import { advisoryGates, isMainContext, REPO } from './derived-artifacts.mjs';

const cmd = process.argv.slice(2).join(' ');
if (!cmd) {
  console.error('Usage: node scripts/run-gate.mjs <command...>');
  process.exit(2);
}

try {
  execSync(cmd, { stdio: 'inherit' });
  process.exit(0);
} catch (e) {
  if (!isMainContext() && advisoryGates().has(cmd)) {
    // MERGEQUEUE-GATE-PARITY-1: the downgrade is a claim ("main's regen repairs
    // this after merge"), so verify it instead of inheriting it (SO #34). The
    // probe runs the declared regen in a throwaway worktree off HEAD and re-runs
    // this very gate there. Exit non-zero from the probe means the main-side
    // writer CANNOT erase this drift, so it would survive the merge — block.
    try {
      execSync(`node scripts/check-regen-repairable.mjs --gate ${JSON.stringify(cmd)}`, {
        cwd: REPO,
        stdio: 'inherit',
      });
    } catch (probeErr) {
      console.log(
        `::error title=Not repairable by the main-side regen::${cmd} — this drift survives the ` +
        `merge and reds main, so SO #35's hand-off to derived-artifacts-regen.yml does not apply. ` +
        `Fix it in this PR.`
      );
      process.exit(typeof probeErr.status === 'number' && probeErr.status !== 0 ? probeErr.status : 1);
    }
    console.log(
      `::warning title=Advisory: shared derived artifact stale::${cmd} — single-writer ` +
      `(SO #35); regen on main repairs it after merge (verified by check-regen-repairable.mjs).`
    );
    process.exit(0);
  }
  process.exit(typeof e.status === 'number' ? e.status : 1);
}

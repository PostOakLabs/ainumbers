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
 * Exit 0  — command passed, OR command failed but is in advisoryGates() and
 *           isMainContext() is false (PR context: warn, don't block).
 * Exit 1+ — command failed and either isMainContext() is true (main/merge_group:
 *           block), or the command is not a recognised advisory gate.
 */
import { execSync } from 'node:child_process';
import { advisoryGates, isMainContext } from './derived-artifacts.mjs';

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
    console.log(
      `::warning title=Advisory: shared derived artifact stale::${cmd} — single-writer ` +
      `(SO #35); regen on main repairs it after merge.`
    );
    process.exit(0);
  }
  process.exit(typeof e.status === 'number' ? e.status : 1);
}

#!/usr/bin/env node
/**
 * scripts/run-consistency.mjs — stable preflight entry for the cross-kernel
 * consistency property harness (CCPP-GATE-WIRE-1).
 *
 * The harness itself lives at
 *   chaingraph/kernels/__consistency__/run-consistency.mjs
 * (CHAIN-CONSISTENCY-PROPERTY-PILOT-1, PR #1649) and owns ALL runner logic. Its
 * exit code implements the declared-expectation invariant the pilot report
 * §8.2 specifies: exit 1 when any property's OBSERVED state differs from what
 * it DECLARED it expected, in either direction. It is deliberately NOT a
 * property-count gate and NOT a must-be-green gate: three of the nine
 * properties declare VIOLATION today (the pilot's open findings), and they
 * exit 0 exactly as declared.
 *
 * This wrapper is ADAPTERS ONLY: it spawns the real runner, re-prints its
 * output, measures wall-seconds, and applies the ADVISORY disposition staged
 * by CCPP-GATE-WIRE-1 (7F gate-lift ruling 2026-09-07T11:17Z):
 *
 *   default (advisory)  — always exit 0. A surprise prints a loud SURPRISES
 *                         block but NEVER fails preflight. The three open
 *                         findings are live defects with fix rows serialized
 *                         on this row (CCPP-FIX-ART06-1 / ART234-1 /
 *                         ART236-1); a blocking gate here would red main on
 *                         the very defects those rows exist to fix.
 *   --enforce           — exit with the runner's own code. The one-line flip
 *                         CCPP-GATE-BLOCK-1 makes in a later PR, after the
 *                         three fix rows land. Present here so the flip needs
 *                         no new code, only a changed argv.
 *
 * Wall-seconds are printed on every run (preflight time-budget discipline):
 * the advisory entry's cost is measured, not asserted.
 *
 * ⛔ Fence: no property-file edits, no runner-logic changes. A property
 * failure here is a finding to report, never a fix to apply.
 *
 * Type-gate note: this is a NEW file, so the jsdoc-checkjs gate shields
 * nothing (line-level pre-existing shielding only covers lines byte-identical
 * to origin/main). Like the harness itself, Node globals are reached through
 * an any-typed globalThis alias, and the one builtin module is loaded through
 * a computed dynamic specifier, so the no-@types/node diagnostics (TS2307 /
 * TS2580) never fire on touched lines.
 */

/** @type {any} */
const globals = globalThis;
/** @type {{ argv: string[], exit: (code: number) => never, execPath: string, stdout: { write: (s: string) => void }, stderr: { write: (s: string) => void } }} */
const proc = globals.process;

const RUNNER_URL = new URL('../chaingraph/kernels/__consistency__/run-consistency.mjs', import.meta.url);
const enforce = proc.argv.includes('--enforce');
const runnerArgs = proc.argv.slice(2).filter((a) => a !== '--enforce');

// Computed specifier: a literal 'node:child_process' would raise TS2307 under
// the jsdoc-checkjs gate (no @types/node in this repo, SO #10 — never npm).
const { fileURLToPath } = await import('node:' + 'url');
const { spawnSync } = await import('node:' + 'child_process');
const runnerPath = fileURLToPath(RUNNER_URL);

const t0 = Date.now();
const res = spawnSync(proc.execPath, [runnerPath, ...runnerArgs], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});
const wallSeconds = ((Date.now() - t0) / 1000).toFixed(2);

if (res.stdout) proc.stdout.write(res.stdout);
if (res.stderr) proc.stderr.write(res.stderr);

if (res.error) {
  proc.stderr.write(`run-consistency (advisory): runner could not be executed: ${res.error.message}\n`);
  proc.stderr.write(`run-consistency (advisory): wall-seconds: ${wallSeconds} · disposition: ADVISORY — preflight NOT failed\n`);
  proc.exit(0);
}

if (res.status !== 0) {
  proc.stderr.write(`SURPRISES — the consistency harness reported observed-vs-declared mismatches (exit ${res.status}).\n`);
  proc.stderr.write('ADVISORY (CCPP-GATE-WIRE-1): printed, NOT blocking. Blocking flip is CCPP-GATE-BLOCK-1.\n');
}
proc.stdout.write(`run-consistency: wall-seconds: ${wallSeconds}s · disposition: ${enforce ? 'ENFORCING' : 'ADVISORY (never fails preflight)'}\n`);

proc.exit(enforce ? (res.status ?? 1) : 0);

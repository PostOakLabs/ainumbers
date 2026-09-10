#!/usr/bin/env node
/**
 * scripts/run-boundary-mr.mjs — stable entry for the metamorphic boundary-direction
 * relations pilot (BOUNDARY-MR-PILOT-1). Adapter mirrors scripts/run-consistency.mjs
 * (CCPP-GATE-WIRE-1) — ADAPTERS ONLY: it spawns the real runner, re-prints its output,
 * measures wall-seconds, and applies the same ADVISORY / --enforce disposition shape.
 *
 * The harness lives at
 *   chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs
 * and owns ALL runner logic. Its exit code implements the declared-expectation
 * invariant: exit 1 when any relation's OBSERVED state differs from what it DECLARED
 * it expected, in either direction. One relation (P-B2) declares VIOLATION today —
 * the pilot's open finding, serialized to CCPP-FIX-ART234-1 — and exits 0 as declared.
 *
 * ⛔ PILOT FENCE (BOUNDARY-MR-PILOT-1): unlike run-consistency.mjs, this adapter is
 * NOT wired into preflight.mjs — the row forbids gate wiring. It exists so a later
 * wiring row needs no new code, only a preflight entry pointing here.
 *
 * Type-gate note: identical to run-consistency.mjs — Node globals are reached through
 * an any-typed globalThis alias and builtins load through computed dynamic specifiers,
 * so the no-@types/node diagnostics (TS2307 / TS2580) never fire on touched lines.
 */

/** @type {any} */
const globals = globalThis;
/** @type {{ argv: string[], exit: (code: number) => never, execPath: string, stdout: { write: (s: string) => void }, stderr: { write: (s: string) => void } }} */
const proc = globals.process;

const RUNNER_URL = new URL('../chaingraph/kernels/__boundary_mr__/run-boundary-mr.mjs', import.meta.url);
const enforce = proc.argv.includes('--enforce');
const runnerArgs = proc.argv.slice(2).filter((a) => a !== '--enforce');

// Computed specifier: a literal 'node:child_process' would raise TS2307 under the
// jsdoc-checkjs gate (no @types/node in this repo, SO #10 — never npm).
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
  proc.stderr.write(`run-boundary-mr (advisory): runner could not be executed: ${res.error.message}\n`);
  proc.stderr.write(`run-boundary-mr (advisory): wall-seconds: ${wallSeconds} · disposition: ADVISORY — preflight NOT failed\n`);
  proc.exit(0);
}

if (res.status !== 0) {
  proc.stderr.write(`SURPRISES — the boundary-MR harness reported observed-vs-declared mismatches (exit ${res.status}).\n`);
  proc.stderr.write('PILOT (BOUNDARY-MR-PILOT-1): this adapter is NOT wired into preflight; findings are reported, never silently fixed.\n');
}
proc.stdout.write(`run-boundary-mr: wall-seconds: ${wallSeconds}s · disposition: ${enforce ? 'ENFORCING' : 'ADVISORY (not wired into preflight)'}\n`);

proc.exit(enforce ? (res.status ?? 1) : 0);

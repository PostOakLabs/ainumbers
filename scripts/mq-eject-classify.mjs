#!/usr/bin/env node
// MERGE-GROUP-CHECKOUT-REQUEUE-1: classify a failed merge_group run log (stdin)
// for automerge-label.yml's dequeued path. Prints one JSON line:
//   { "kind": "checkout-fatal" | "cancelled-leg" | "derived-gate" | "other", "gates": [...] }
// - checkout-fatal: a failed step printed `fatal: '<ref>' is not a commit` on a
//   gh-readonly-queue ref (the queue group was rebuilt before the job checked
//   out). Safe to re-enqueue once.
// - derived-gate: no checkout fatal, and a DERIVED_ROOT_GATES command appears on
//   a failure line (a real stale-after-merge result). Never auto re-queued; the
//   workflow reports it as `[MQ-EJECT]` for the coordinator.
// - cancelled-leg: a required leg reported `cancelled` and no line shows a gate
//   that actually failed (MQ-EJECT-CANCELLED-LEG-REQUEUE-1). A re-run, handled
//   like checkout-fatal. A log mixing a real failure with cancellations is
//   never cancelled-leg.
// - other: anything else. Left alone.
// Always exits 0; the verdict is the JSON.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHECKOUT_FATAL = /fatal: 'refs\/remotes\/origin\/gh-readonly-queue\/[^']+' is not a commit/;
// The aggregate `required` job's own verdict line for a cancelled leg
// (`##[error]a required leg reported 'cancelled' (not success/skipped)`).
const CANCELLED_LEG = /a required leg reported 'cancelled'|RESULT: cancelled/;
const FAILURE_LINE =/##\[error\]|✗|\bFAIL(ED)?\b|\bRED\b/;

export function classify(log, derivedGates) {
  const lines = String(log).split('\n');
  if (lines.some((l) => CHECKOUT_FATAL.test(l))) return { kind: 'checkout-fatal', gates: [] };
  const hit = new Set();
  let realFailure = false;
  let cancelled = false;
  for (const l of lines) {
    if (CANCELLED_LEG.test(l)) { cancelled = true; continue; }
    if (!FAILURE_LINE.test(l)) continue;
    realFailure = true;
    for (const g of derivedGates) if (l.includes(g)) hit.add(g);
  }
  if (hit.size) return { kind: 'derived-gate', gates: [...hit] };
  if (cancelled && !realFailure) return { kind: 'cancelled-leg', gates: [] };
  return { kind: 'other', gates: [] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DERIVED_ROOT_GATES } = await import('./derived-artifacts.mjs');
  console.log(JSON.stringify(classify(readFileSync(0, 'utf8'), [...DERIVED_ROOT_GATES])));
}

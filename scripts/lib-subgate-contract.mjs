#!/usr/bin/env node
// scripts/lib-subgate-contract.mjs — NAV-SUBGATE-CRASH-1
//
// ══════════════════════════════════════════════════════════════════════════════
// THE DEFECT THIS EXISTS TO END, measured 2026-08-27 on the SAME commit
// (53359d3f, PR #1520), board/NAV-ISLAND-DIAGNOSTIC-2026-08-27.md:
//
//   full clone     ->  check-shard-assembly exit 0, PENDING-ASSEMBLE section
//                      ->  nav-reachability: OK — 0 new islands           (exit 0)
//   --depth 1      ->  check-shard-assembly exit 1, "BASE REF UNRESOLVED"
//                      ->  nav-reachability: 1 NEW island(s)              (exit 1)
//
// The parent spawned a sub-gate, IGNORED its exit code, and string-matched its
// stdout for a `PENDING-ASSEMBLE —` prefix. When that prefix was absent because
// the sub-gate could not evaluate its own input, the parent excused nothing and
// emitted a SPECIFIC, CONFIDENT, WRONG finding — an island that does not exist.
// That is worse than a silent pass: it stranded 4 rows and 3 PRs for a day
// (0xAlpha/2026-08-27-GATE-FRICTION-AUDIT.md §3.2), each of them chasing a
// content defect that was never there. The shallow clone was the TRIGGER; the
// swallow is the DEFECT, and the swallow is what this file removes.
//
// ══════════════════════════════════════════════════════════════════════════════
// THE CONTRACT — positive evidence required, fail CLOSED by default.
//
// A sub-gate's answer may be parsed into a parent verdict ONLY on positive
// evidence that the sub-gate reached and completed the question it was asked.
// Absent that evidence the answer is NOT_EVALUABLE (board/row-state-enum.json,
// SSOT per SO #58) and the PARENT MUST NOT EMIT ITS OWN VERDICT AT ALL. Not a
// pass, not a finding — a distinct, named, non-zero third state (SO #34c).
//
// Five things are checked, in this order:
//   1. spawn/load/crash class — the #1489 evidence rules below;
//   2. the exit status is one the sub-gate documents (anything else is a state
//      the parent has never been told how to read — friction audit §3.2 pt 1);
//   3. the sub-gate did NOT declare its own input unevaluable (its own
//      fail-closed line, e.g. `BASE REF UNRESOLVED` — the measured case: it
//      exits 1 having behaved PERFECTLY CORRECTLY, and its correctness is
//      exactly why the exit code alone cannot carry this);
//   4. a completion marker the sub-gate only prints once it has finished;
//   5. only then: parse.
//
// ⚠ (3) IS THE LOAD-BEARING ONE AND (2) ALONE WOULD HAVE MISSED IT. The
// measured child exits 1 — a documented code — with no crash, no stack, no
// signal. The friction audit's "exit >= 2" sketch does not catch it. What
// catches it is the child's OWN declaration that it failed closed, plus the
// requirement that the parent see a completion marker before it parses.
//
// ══════════════════════════════════════════════════════════════════════════════
// PROVENANCE OF THE CRASH RULES — REUSED, NOT REINVENTED (SO #34).
//
// `classifySubGateFailure()` is ADVISORY-CRASH-DISTINCT-1's classifier (PR
// #1489), rule-for-rule and regex-for-regex, from scripts/preflight.mjs
// (`classifyExecFailure`, ~lines 240–305). ⛔ ZERO new crash-detection logic is
// invented here: same six evidence rules, same order, same DEFAULT of "it ran",
// same stderr-only matching, same both-halves requirement on rule (6).
//
// It is a NEW SHARED LIB rather than an import, and that was not a preference:
// preflight.mjs EXECUTES on import (`assertRepoFresh()` runs at module load and
// can `process.exit(1)`), so it is not importable at all — the ORCH's own
// premise note records the same finding ("runner-embedded logic, not an
// importable module"). The two candidate routes were:
//   (a) extract the classifier OUT of preflight.mjs into this file and have
//       preflight import it — ⛔ REJECTED: that edits preflight.mjs, and this
//       row's fence is "zero other gates". preflight is the pre-push hook; it
//       is the worst file in the estate to touch from a fenced row.
//   (b) this file: the same rules, carried where a second consumer can reach
//       them, with preflight named here as the origin.
// ⇒ Folding preflight.mjs onto this lib is the RIGHT end state and is
// DELIBERATELY NOT DONE HERE. It is named, not staged, per the row's
// "named not fixed" instruction.
//
// ══════════════════════════════════════════════════════════════════════════════
// SUBCODE. board/row-state-enum.json ships exactly three NOT_EVALUABLE
// subcodes — NETWORK / PREMISE / LOOKUP — and SO #58 forbids emitting a token
// that is not in the enum. A sub-gate that could not run is none of NETWORK
// (no fetch involved) or LOOKUP (no domain table), so every case here maps to
// `NOT_EVALUABLE-PREMISE`: the premise "the sub-gate produced a classification"
// is unestablished. The distinction between "it crashed" and "it declared its
// own base ref unresolvable" is carried in the human-readable `reason`, which
// is where it belongs — inventing a CRASH subcode would need Tim's approval and
// an enum entry BEFORE any checker emits it.
//
// Zero-dep: node: builtins only (site repo is zero-dep, SO #10). No eval, no
// network, no npm.

import { execFileSync } from 'node:child_process';

// The canonical enum tokens (board/row-state-enum.json). Hardcoded as literals,
// exactly as scripts/assert-checkout-freshness.mjs hardcodes them and for the
// same stated reason: this file must also run from a bare `ainumbers` checkout
// with no sibling board/ directory (CI, or a clone with no workspace around it).
export const SUBGATE_VERDICT = Object.freeze({
  EVALUABLE: 'EVALUABLE',
  NOT_EVALUABLE: 'NOT_EVALUABLE',
});
export const NOT_EVALUABLE_PREMISE = 'NOT_EVALUABLE-PREMISE';

// ── #1489's evidence rules, verbatim ──────────────────────────────────────────
const SPAWN_ERRNOS = new Set([
  'ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'EISDIR', 'ELOOP',
  'E2BIG', 'EMFILE', 'ENFILE', 'ENOMEM', 'EAGAIN', 'ETXTBSY',
]);
const SHELL_CANNOT_EXEC = /is not recognized as an internal or external command|: command not found|^(?:sh|bash|dash|zsh|\/bin\/\w+)(?::\s*\d+)?:[^\n]*: not found$|The system cannot find the path specified/m;
const MODULE_LOAD_FAILURE = /ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION|Cannot find module|Cannot find package/;
const UNCAUGHT_ERROR_NAME = /^(?:\w*Error|\w*Exception)\b|^\s*throw \w+;\s*$/m;
const STACK_FRAME = /^\s+at\s+\S+/m;
const CAUSE_LINE = /^(?:\w*Error|\w*Exception)\b|Cannot find (?:module|package)|is not recognized as an internal or external command|: command not found|: not found\b|The system cannot find the path specified/;

/** First line that names a CAUSE, not the location header Node leads a crash with. */
export function firstDiagnosticLine(text) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => CAUSE_LINE.test(l)) || lines[0];
  if (!line) return '(no output)';
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

/**
 * Did the child produce a verdict at all, or did it never get that far?
 * ADVISORY-CRASH-DISTINCT-1's rules (PR #1489), unchanged — the DEFAULT is
 * "it ran": a child is only called not-run on POSITIVE evidence. A checker that
 * deliberately exits non-zero to report a finding IS a result and stays one.
 * @param {any} e the error `execFileSync` threw
 * @returns {{ ran: boolean, reason: string }}
 */
export function classifySubGateFailure(e) {
  const stderr = e?.stderr?.toString() || '';
  if (e?.code && SPAWN_ERRNOS.has(e.code)) {
    return { ran: false, reason: `the sub-gate could not be started (${e.code}) — missing, unreadable or not executable` };
  }
  if (e?.signal) {
    return { ran: false, reason: `the sub-gate was killed by ${e.signal} before producing a verdict` };
  }
  if (e?.status === null || e?.status === undefined) {
    return { ran: false, reason: 'the sub-gate produced no exit status, so it produced no verdict' };
  }
  // stderr ONLY, on purpose (see #1489): a checker's own findings go to stdout
  // as often as not, and matching them here would reclassify a real result as
  // "no result" — the exact inversion this whole family of rows exists to stop.
  if (SHELL_CANNOT_EXEC.test(stderr)) {
    return { ran: false, reason: `the sub-gate could not be executed: ${firstDiagnosticLine(stderr)}` };
  }
  if (MODULE_LOAD_FAILURE.test(stderr)) {
    return { ran: false, reason: `the sub-gate never loaded: ${firstDiagnosticLine(stderr)}` };
  }
  if (UNCAUGHT_ERROR_NAME.test(stderr) && STACK_FRAME.test(stderr)) {
    return { ran: false, reason: `the sub-gate crashed before reporting: ${firstDiagnosticLine(stderr)}` };
  }
  return { ran: true, reason: `the sub-gate ran and exited ${e?.status}` };
}

/**
 * Apply a sub-gate contract to a completed (or failed) run.
 *
 * @param {object} run     { status, out, err, error } — `error` is what
 *                         execFileSync threw, or null on a clean exit.
 * @param {object} contract
 *   name                  human name of the sub-gate, for the reason string
 *   acceptedExitCodes     exit codes the sub-gate DOCUMENTS. Anything else is a
 *                         state the parent was never told how to read.
 *   completionMarkers     RegExp[] — at least one must match the combined
 *                         output. These are lines the sub-gate prints only once
 *                         it has finished the question the parent asked.
 *   notEvaluableMarkers   [{ re, reason }] — the sub-gate's OWN declarations
 *                         that it failed closed on its input.
 * @returns {{ verdict: string, subcode: string|null, reason: string, out: string }}
 */
export function classifySubGateRun(run, contract) {
  const out = `${run.out || ''}${run.err || ''}`;
  const name = contract.name;

  if (run.error) {
    const c = classifySubGateFailure(run.error);
    if (!c.ran) {
      return { verdict: SUBGATE_VERDICT.NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, reason: `${name}: ${c.reason}`, out };
    }
  }

  const status = run.status;
  if (!contract.acceptedExitCodes.includes(status)) {
    return {
      verdict: SUBGATE_VERDICT.NOT_EVALUABLE,
      subcode: NOT_EVALUABLE_PREMISE,
      reason: `${name}: exited ${status}, which is not one of its documented exit codes (${contract.acceptedExitCodes.join(', ')}) — the parent has no reading for that state`,
      out,
    };
  }

  for (const m of contract.notEvaluableMarkers || []) {
    if (m.re.test(out)) {
      return { verdict: SUBGATE_VERDICT.NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, reason: `${name}: ${m.reason}`, out };
    }
  }

  const completed = (contract.completionMarkers || []).some((re) => re.test(out));
  if (!completed) {
    return {
      verdict: SUBGATE_VERDICT.NOT_EVALUABLE,
      subcode: NOT_EVALUABLE_PREMISE,
      reason: `${name}: exited ${status} without printing any of its completion lines, so it never reached a classification`,
      out,
    };
  }

  return { verdict: SUBGATE_VERDICT.EVALUABLE, subcode: null, reason: `${name}: ran to completion and exited ${status}`, out };
}

/**
 * Spawn a sub-gate and classify the result against its contract. Never throws
 * for a sub-gate failure — a sub-gate that dies must produce a VERDICT for the
 * parent to act on, not an exception the parent would have to catch (catching
 * is how the swallow happened in the first place).
 */
export function runSubGate(argv, execOpts, contract) {
  let run;
  try {
    run = { status: 0, out: execFileSync(argv[0], argv.slice(1), { ...execOpts, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }), err: '', error: null };
  } catch (e) {
    run = { status: typeof e?.status === 'number' ? e.status : null, out: e?.stdout?.toString() || '', err: e?.stderr?.toString() || '', error: e };
  }
  return classifySubGateRun(run, contract);
}

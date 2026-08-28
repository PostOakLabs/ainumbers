#!/usr/bin/env node
/**
 * scripts/preflight.mjs — run EVERY hard CI gate locally, in CI order.
 *
 * Purpose: kill the push → CI-fail → fix → re-push churn. Green here ⇒ green in
 * the "Deploy to DreamHost" pre-flight job. Run before EVERY push:
 *   node scripts/preflight.mjs
 *
 * Mirrors .github/workflows/deploy-to-dreamhost.yml (the hard, blocking gates).
 * Soft/warn-only CI steps (line-ending guard, manifest-parity, count summaries)
 * are intentionally omitted — they don't fail the build. Stops on first failure.
 *
 * Worker repo (mcp-apps-poc) has its OWN CI gates — this is the SITE preflight.
 *
 * ── MODES ───────────────────────────────────────────────────────────────────
 *   node scripts/preflight.mjs
 *       DEFAULT, UNCHANGED: fail-fast. Stops at the first red gate, exits 1, and
 *       reports nothing about the gates behind it. This is what CI
 *       (scripts-verify.yml), the pre-push hook and assemble-land.mjs run, and
 *       every line of that path is deliberately left exactly as it was.
 *
 *   node scripts/preflight.mjs --quiet
 *       Output-only: same gates/order/exit code; suppresses per-gate progress lines and
 *       prints only failures/advisories (with label + captured output), DID-NOT-RUN,
 *       TOTAL and the summary blocks. ~10 lines on a green run instead of ~180.
 *       Combine with --keep-going for the cheapest full report a session can read.
 *   node scripts/preflight.mjs --keep-going
 *       Runs EVERY gate, collects every result, prints a per-gate
 *       PASS / FAIL / ADVISORY / UNAVAILABLE / DID-NOT-RUN list with totals derived
 *       from the gate list at runtime, and exits 1 if any unwaived gate failed.
 *
 *   node scripts/preflight.mjs --self-test
 *       ADVISORY-CRASH-DISTINCT-1's own control. Exits immediately after the
 *       reporting machinery is defined — no gate runs, no git diff, no estate
 *       scan — and proves, with REAL subprocesses and the REAL classifier, that
 *       a checker which could not run reports `✗ UNAVAILABLE`, that a checker
 *       which ran and warned still reports `⚠ ADVISORY`, and that the result
 *       accounting detects an unrecorded gate instead of absorbing it.
 *       Also L2-HARDLEG-BLOCKING-1's control: the L2 hard leg BLOCKS when its
 *       checker produced no verdict and this diff touches a chain shard, does
 *       NOT block when nothing is touched, and still leaves every untouched
 *       L2-fail chain advisory. Wired into GATES below, so it actually runs.
 *
 *   node scripts/preflight.mjs --expect-red <gate-id>
 *       Declares a gate expected to be red on THIS invocation. Matched
 *       case-insensitively as a substring of the gate label; repeatable; implies
 *       --keep-going. The declaration is named in the output and lives only in
 *       this argv — there is deliberately NO waiver file, because a persisted
 *       waiver accumulates silently, which is the defect this flag answers
 *       rather than a second copy of it. An id matching no gate is a hard error.
 *
 * WHY --keep-going EXISTS (PREFLIGHT-KEEPGOING-1). On a shard branch a
 * hash-moving CGSHARD-1 red is expected BY CONSTRUCTION, and that gate sits
 * early in the list, so a fail-fast run proves nothing at all about the gates
 * behind it — while still LOOKING like preflight ran. STABLECOIN-3SRC-D-1 hit
 * exactly that and had to extract the gate list and run every gate by hand to
 * get real coverage. A command that stops proves nothing about what it never
 * reached, so under --keep-going "did not run" is reported as its own category
 * and is NEVER folded into "passed" (SO #34c: absence of a red is not a pass).
 *
 * WHY `✗ UNAVAILABLE` EXISTS (ADVISORY-CRASH-DISTINCT-1). The same order, one
 * level down. Every advisory surface here used to sit in a bare try/catch, so a
 * checker that CRASHED, a checker that was MISSING, and a checker that ran fine
 * and had something mild to say all printed the same reassuring line. Absence of
 * a result is a distinct state, never a soft pass — so a checker that could not
 * run is now its own category, `✗ UNAVAILABLE`, counted in the --keep-going
 * totals and named in the final summary line. It is LOUD, not BLOCKING: no
 * advisory was promoted to a hard gate, and the exit code is untouched.
 *
 * THE ONE EXCEPTION (L2-HARDLEG-BLOCKING-1). Exactly one leg inside an otherwise
 * advisory block is HARD: a chain shard added or edited in this diff must not
 * enter with an `L2-fail` edge (spec §6.1). Being loud about that leg not firing
 * was not enough — so when, and ONLY when, this diff adds/edits at least one chain
 * shard AND the L2 checker produced no verdict, preflight now exits 1 instead of
 * printing `✗ UNAVAILABLE` and passing. Every other advisory, and the rest of the
 * L2 block, is untouched and still never affects the exit code. See the block
 * comment above `decideL2HardLeg()` for the shape and its measured blast radius.
 */
import { execSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// PREFLIGHT-STALE-REFUSE-1: resolve the site-repo path LOUDLY, then validate it
// before any gate runs — never silently trust it. DEFAULT resolution (no --repo=)
// is UNCHANGED: the script's own on-disk location, which is always wherever the
// invoker is actually sitting and running it from. A dirty tree there is the
// invoker's own in-progress work — exactly what "run before every push" means,
// and exactly what the git-diff-vs-HEAD scoping throughout this file (helmPathsTouched,
// touchedFloorFiles, --changed, etc.) already assumes is normal — so default mode
// never refuses on it. An explicit --repo=<path> (WITH THE EQUALS — the documented
// silent-no-op trap, see memory feedback-generate-mjs-repo-flag-needs-equals) points
// at a checkout the invoker does NOT necessarily own — the shared repo/ tree, a
// leftover worktree, anything — so THAT path is refused if dirty or not a descendant
// of origin/main, closing the "silently resolves to a stale clone" hazard (P13,
// board/done/PREFLIGHT-STALE-REFUSE-1.md) without touching the pre-push gate every
// session already depends on.
function resolveRepoPath() {
  const flag = process.argv.find((a) => a.startsWith('--repo='));
  if (flag) return { path: resolve(flag.slice('--repo='.length)), via: '--repo= flag', strict: true };
  return { path: resolve(dirname(fileURLToPath(import.meta.url)), '..'), via: 'script location (default)', strict: false };
}

// Refuses (exit 1, plain diagnosis) when `strict` is true and repoPath is either
// dirty (`git status --porcelain` non-empty) or not a descendant of origin/main
// (`git merge-base --is-ancestor origin/main HEAD`). Always prints the resolved
// path + how it was reached; always prints why it was accepted when it is.
//
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): every git call here passes env: gitEnv(). This is SO #48's
// own instrument, so it is the worst possible place to answer about the wrong tree. `repoPath` can
// legitimately be a DIFFERENT repository from the ambient one (--repo=<path>), and under the
// pre-push hook an inherited GIT_DIR beats `cwd` outright. Measured on this branch before the fix:
// with GIT_DIR pointed at a second repo, this function printed "REFUSING: <repoPath> ... is not a
// descendant of origin/main" — a verdict computed from the OTHER repo, attributed by name to
// repoPath — while the real defect in repoPath (1 dirty path) went entirely unseen.
function assertRepoFresh(repoPath, via, strict) {
  console.log(`[repo-resolve] site-repo: ${repoPath} (via ${via})`);
  const fixMsg = '   Fix: pass --repo=<path> WITH THE EQUALS (--repo=<path>, not --repo <path>) at a clean, up-to-date checkout, or run from a clean worktree (git fetch + branch off current origin/main).';
  let isGitRepo = true;
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: repoPath, env: gitEnv(), stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { isGitRepo = false; }
  if (!isGitRepo) {
    console.error(`❌ REFUSING: ${repoPath} is not a git repository (or does not exist).`);
    console.error(fixMsg);
    process.exit(1);
  }
  let porcelain = '';
  try {
    porcelain = execSync('git status --porcelain', { cwd: repoPath, env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { porcelain = ''; }
  if (strict && porcelain) {
    const lines = porcelain.split('\n');
    console.error(`❌ REFUSING: ${repoPath} is dirty (${lines.length} changed path(s)) — resolved via ${via}, not necessarily the invoker's own worktree, so it cannot be trusted as a clean source.`);
    for (const l of lines.slice(0, 10)) console.error(`     ${l}`);
    if (lines.length > 10) console.error(`     … and ${lines.length - 10} more`);
    console.error(fixMsg);
    process.exit(1);
  }
  let isDescendant = true;
  if (strict) {
    try {
      execSync('git rev-parse --verify origin/main', { cwd: repoPath, env: gitEnv(), stdio: 'ignore' });
      execSync('git merge-base --is-ancestor origin/main HEAD', { cwd: repoPath, env: gitEnv(), stdio: 'ignore' });
    } catch { isDescendant = false; }
    if (!isDescendant) {
      console.error(`❌ REFUSING: HEAD in ${repoPath} is not a descendant of origin/main (git merge-base --is-ancestor) — stale checkout.`);
      console.error(fixMsg);
      process.exit(1);
    }
  }
  console.log(strict
    ? `[repo-resolve] accepted: clean and descends from origin/main.`
    : `[repo-resolve] accepted: default resolution = invoker's own worktree, dirty/staleness check not applicable.`);
}

const { path: REPO, via: REPO_VIA, strict: REPO_STRICT } = resolveRepoPath();
assertRepoFresh(REPO, REPO_VIA, REPO_STRICT);
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): was `{ ...process.env, ... }`. This object is the environment
// EVERY gate subprocess below inherits, so scrubbing GIT_* once here protects the whole suite, not
// just preflight's own git calls — a gate that shells to git can no longer be redirected at the
// outer repository by the pre-push hook that invoked it.
//
// ⚠ This is a no-op OUTSIDE a hook, by construction: with no GIT_* set, gitEnv() returns exactly
// what `{ ...process.env }` returned. Verdicts and numbers are therefore provably unchanged in CI
// and in a plain terminal run, and only differ where they were previously WRONG — under a hook.
const env = gitEnv({ PYTHONIOENCODING: 'utf-8' }); // Windows: python gates print ✓/✗

// --changed <ref>: incremental mode for local/pre-push runs only (PREFLIGHT-BUDGET-1 §1).
// Scopes verify_repo.py to files touched vs <ref>. CI never passes this — the
// land-verify.yml / deploy-to-dreamhost.yml workflows call the gates directly with a
// full-estate scan, so nothing here weakens what CI checks.
const changedIdx = process.argv.indexOf('--changed');
const changedRef = changedIdx !== -1 ? process.argv[changedIdx + 1] : null;
const BUDGET_MS = 60_000;

// PREFLIGHT-KEEPGOING-1 — run-all / report-all mode. STRICTLY ADDITIVE: with
// neither flag present KEEP_GOING is false, and every branch below that reads it
// collapses to exactly the code that was there before. Same gate list, same order,
// same fail-fast point, same exit code, same stdout on the default path.
const KEEP_GOING_FLAG = process.argv.includes('--keep-going');
// --quiet (2026-08-17, Tim: token optimizations with little downside). OUTPUT-ONLY: same gates,
// same order, same exit code, same fail-fast point. Suppresses the per-gate "▶ label … ✓ (ms)"
// progress lines (~180 lines on a green run) and prints only: failures/advisories WITH the gate
// label and their captured output, DID-NOT-RUN lines, the TOTAL, the budget advisory, and the
// summary blocks. A green run under --quiet is therefore ~10 lines. Sessions that must READ
// preflight output should use it; humans watching a terminal probably want the default.
const QUIET = process.argv.includes('--quiet');
let _pendingLabel = null; // under --quiet we defer printing "▶ label" until we know it failed
function gateStart(label) { if (QUIET) { _pendingLabel = label; return; } process.stdout.write(`▶ ${label} … `); }
function gatePass(msg)    { if (QUIET) { _pendingLabel = null; return; } console.log(msg); }
function gateFail(msg)    { if (QUIET && _pendingLabel !== null) { process.stdout.write(`▶ ${_pendingLabel} … `); _pendingLabel = null; } console.log(msg); }
// --expect-red <gate-id>, repeatable. PER-INVOCATION ONLY — resolved against the
// gate labels at startup, named in the output, and gone when the process exits.
// No file is read or written; nothing carries into the next run.
const EXPECT_RED = process.argv.reduce((acc, a, i) => {
  if (a === '--expect-red' && process.argv[i + 1]) acc.push(process.argv[i + 1]);
  return acc;
}, []);
// `let`, not `const`: a CI run on main promotes this to true below, once
// isMainContext() is available (see the MAIN_CONTEXT assignment). Every branch
// that reads KEEP_GOING is far below that point — first use is the gate loop.
let KEEP_GOING = KEEP_GOING_FLAG || EXPECT_RED.length > 0;
const expectedRedFor = (label) =>
  EXPECT_RED.find((id) => label.toLowerCase().includes(id.toLowerCase())) || null;

// ── ADVISORY-CRASH-DISTINCT-1: A CHECKER THAT COULD NOT RUN IS NOT AN ADVISORY ──
// SO #34c ("a missing gate result is a DISTINCT state, never a green one"), applied
// to the advisory surfaces. Before this, every advisory in this file sat in a bare
// `try { … } catch { … }`, so THREE different outcomes printed the same line:
//   · the checker ran and had something mild to say   → a real, readable result
//   · the checker was missing / could not be spawned  → NO RESULT AT ALL
//   · the checker crashed (syntax error, throw, kill) → NO RESULT AT ALL
// The last two now print `✗ UNAVAILABLE` — their own category, counted in the
// --keep-going totals and named in the final summary line — because "we learned
// nothing" must never read like "we learned something mild".
//
// ⛔ WHAT THIS DELIBERATELY DOES NOT DO. It does not promote any advisory to a
// hard gate: UNAVAILABLE is LOUD, not BLOCKING, and no exit code changes. That
// promotion is a separate decision and is explicitly out of this row's fence.
//
// CLASSIFICATION IS EVIDENCE-BASED AND DELIBERATELY NARROW. The DEFAULT is "it
// ran" — a failure is only called UNAVAILABLE on positive evidence that no verdict
// was produced:
//   (1) a spawn-class errno on the child (ENOENT/EACCES/…) — it never started;
//   (2) killed by a signal — it died before reaching a verdict;
//   (3) no exit status at all;
//   (4) the shell could not execute it ("is not recognized…", "command not found")
//       — the Windows path, where a missing binary surfaces as exit 1, not ENOENT;
//   (5) a module-resolution failure — node never reached the checker's own code;
//   (6) an UNCAUGHT throw: an error-name line AND a stack frame in stderr.
// ⚠ (6) requires BOTH halves on purpose, and the whole rule set was VERIFIED BY
// MEASUREMENT (2026-08-23) against the real red output of the four gates this row
// names — CGSHARD-1, REGISTRY-RESOLVE-STATIC-1, EUC-SITE-1 (both legs) and the
// kernel-VM explainer freshness gate. Every one exits 1 with a plain diagnostic
// line, no stack frame, no error-name line ⇒ every one still classifies as RAN and
// still prints `⚠ ADVISORY`. A checker that deliberately exits non-zero to report
// a finding IS a result, and stays one. Two of those measured stderr bodies are
// pinned as fixtures in the self-test below so that guarantee cannot silently rot.
const SPAWN_ERRNOS = new Set([
  'ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'EISDIR', 'ELOOP',
  'E2BIG', 'EMFILE', 'ENFILE', 'ENOMEM', 'EAGAIN', 'ETXTBSY',
]);
// ⚠ Both of these are matched against STDERR ONLY, and both are anchored to the
// SHELL's own phrasing rather than to loose words like "not found". A gate that
// prints `✗ registry/kernel/abc.json: not found` as part of a legitimate finding
// must stay a RESULT — so a bare `: not found` is deliberately NOT a signal here.
const SHELL_CANNOT_EXEC = /is not recognized as an internal or external command|: command not found|^(?:sh|bash|dash|zsh|\/bin\/\w+)(?::\s*\d+)?:[^\n]*: not found$|The system cannot find the path specified/m;
const MODULE_LOAD_FAILURE = /ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION|Cannot find module|Cannot find package/;
const UNCAUGHT_ERROR_NAME = /^(?:\w*Error|\w*Exception)\b|^\s*throw \w+;\s*$/m;
const STACK_FRAME = /^\s+at\s+\S+/m;

// Every state a run-list result may carry. The --keep-going tally is derived from
// THIS list, so a new state that nobody wired into the summary shows up as
// `uncategorised` instead of quietly vanishing out of the accounting.
const RESULT_STATES = ['PASS', 'FAIL', 'EXPECTED-RED', 'DID-NOT-RUN', 'ADVISORY', 'UNAVAILABLE'];

// Advisory checkers whose result never arrived. Filled from BOTH the main gate loop
// (a shared-derived-artifact gate that is advisory on a PR) and the trailing advisory
// block at the bottom of this file, then surfaced in the FINAL summary line — the one
// line every invocation prints, including a plain fail-fast run that never reaches the
// --keep-going summary block.
const unavailableAdvisories = []; // [{ label, reason }]

// Node leads a crash with a LOCATION header (`C:\…\x.mjs:12`, `[eval]:1`) and a
// caret line before the sentence that says what actually happened, so "first
// non-empty line" reports the least useful part. Prefer the first line that names
// a cause; fall back to the first non-empty line only if none does.
const CAUSE_LINE = /^(?:\w*Error|\w*Exception)\b|Cannot find (?:module|package)|is not recognized as an internal or external command|: command not found|: not found\b|The system cannot find the path specified/;
function firstDiagnosticLine(text) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => CAUSE_LINE.test(l)) || lines[0];
  if (!line) return '(no output)';
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

/**
 * Did the checker actually produce a verdict, or did it never get that far?
 * @param {any} e the error `execSync` threw
 * @returns {{ ran: boolean, reason: string }}
 */
function classifyExecFailure(e) {
  const stderr = e?.stderr?.toString() || '';
  if (e?.code && SPAWN_ERRNOS.has(e.code)) {
    return { ran: false, reason: `the checker could not be started (${e.code}) — missing, unreadable or not executable` };
  }
  if (e?.signal) {
    return { ran: false, reason: `the checker was killed by ${e.signal} before producing a verdict` };
  }
  if (e?.status === null || e?.status === undefined) {
    return { ran: false, reason: 'the checker produced no exit status, so it produced no verdict' };
  }
  // ⚠ stderr ONLY, on purpose. A checker's own findings go to stdout as often as
  // not, and matching them here would reclassify a real result as "no result" —
  // the exact inversion this row exists to prevent. The shell and node both write
  // these two classes of failure to stderr.
  if (SHELL_CANNOT_EXEC.test(stderr)) {
    return { ran: false, reason: `the checker could not be executed: ${firstDiagnosticLine(stderr)}` };
  }
  if (MODULE_LOAD_FAILURE.test(stderr)) {
    return { ran: false, reason: `the checker never loaded: ${firstDiagnosticLine(stderr)}` };
  }
  if (UNCAUGHT_ERROR_NAME.test(stderr) && STACK_FRAME.test(stderr)) {
    return { ran: false, reason: `the checker crashed before reporting: ${firstDiagnosticLine(stderr)}` };
  }
  return { ran: true, reason: `the checker ran and exited ${e?.status}` };
}

/**
 * Execute an advisory checker and return exactly ONE of three outcomes. ⛔ Never
 * throws — an advisory must not be able to abort preflight, which is precisely why
 * these lived in a swallowing try/catch in the first place. The swallowing is kept;
 * the CONFLATION is what this removes.
 *   { state: 'RAN',         out }          executed, exited 0
 *   { state: 'WARNED',      out, reason }  executed, exited non-zero — a real result
 *   { state: 'UNAVAILABLE', out, reason }  never produced a verdict
 */
function runAdvisoryChecker(cmd) {
  try {
    return { state: 'RAN', out: execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString(), reason: '' };
  } catch (e) {
    const c = classifyExecFailure(e);
    const out = (e?.stdout?.toString() || '') + (e?.stderr?.toString() || '');
    return { state: c.ran ? 'WARNED' : 'UNAVAILABLE', out, reason: c.reason };
  }
}

/** Print the `✗ UNAVAILABLE` line for an advisory and record it for the summary. */
function gateUnavailable(label, reason, out) {
  gateFail(`✗ UNAVAILABLE — ${reason}`);
  const detail = (out || '').trim();
  if (detail) console.log('\n' + detail + '\n');
  unavailableAdvisories.push({ label, reason });
}

/**
 * Tally a result ledger by state. `uncategorised` is the load-bearing field: a
 * result whose state is not in RESULT_STATES is COUNTED AS MISSING rather than
 * silently dropped, so `accounted` can never be talked up to match `length`.
 */
function tallyResults(rs) {
  const counts = Object.fromEntries(RESULT_STATES.map((s) => [s, 0]));
  let uncategorised = 0;
  for (const r of rs) {
    if (Object.prototype.hasOwnProperty.call(counts, r.state)) counts[r.state] += 1;
    else uncategorised += 1;
  }
  return { counts, accounted: RESULT_STATES.reduce((n, s) => n + counts[s], 0), uncategorised };
}

/** The clause appended to the FINAL summary line when an advisory produced no result. */
function unavailableClause(n) {
  return n ? `  ⚠ ${n} advisory checker(s) ✗ UNAVAILABLE — they could not run, so they reported NOTHING.` : '';
}

/**
 * The UNAVAILABLE roll-up, printed immediately above the verdict so it cannot be
 * scrolled past. An UNAVAILABLE is not a failure and not an advisory — it is the
 * absence of either, which is exactly why it needs a name (SO #34c). ⛔ It does
 * NOT block: no advisory was promoted to a hard gate by this row.
 */
function printUnavailableBlock() {
  if (!unavailableAdvisories.length) return;
  console.log(`\n✗ ${unavailableAdvisories.length} ADVISORY CHECKER(S) UNAVAILABLE — they could not run, so they reported NOTHING:`);
  for (const u of unavailableAdvisories) console.log(`    ✗ ${u.label}\n        ↳ ${u.reason}`);
  console.log('    ⛔ This is NOT "advisory" and NOT a pass — nothing was measured here (SO #34c).');
  console.log('    Nothing in THIS roll-up blocks. The one promoted hard leg (L2-HARDLEG-BLOCKING-1,');
  console.log('    below) exits before this list is ever printed, so it can never appear here.');
}

// ── L2-HARDLEG-BLOCKING-1: THE ONE HARD LEG INSIDE THE ADVISORY L2 BLOCK ─────
// The L2 block at the bottom of this file is ADVISORY overall — L2-indeterminate
// is coverage, not wrongness, L2-G is mid-authoring and L3 is parked — but it
// carries ONE genuinely hard leg (spec §6.1): a chain shard ADDED or EDITED in
// this diff must not enter with an `L2-fail` edge.
//
// ⛔ THE DEFECT THIS CLOSES. A hard leg living inside an advisory block inherits
// the block's failure mode: when the checker could not run, the leg did not fire,
// and NOTHING said the hard leg had been skipped — the surrounding advisory still
// printed and preflight still said PASSED. ADVISORY-CRASH-DISTINCT-1 made the
// non-firing VISIBLE (the UNAVAILABLE reason names this leg) and deliberately left
// it non-blocking, because promoting a hard gate was outside that row's fence.
//
// ✅ THE SHAPE, and why it is conditioned rather than absolute. Blocking on EVERY
// could-not-run would red every push the moment the checker breaks, including the
// overwhelming majority that touch no chain at all and therefore lose nothing hard.
// The leg's SUBJECT SET is exactly the touched chain shards, so:
//   · touched chains ≥ 1 and no verdict  ⇒ BLOCK. The hard leg had real subjects
//     and did not run over them; an unrun hard leg is an absent result, never a
//     pass (SO #34c).
//   · touched chains = 0 and no verdict   ⇒ report `✗ UNAVAILABLE`, do not block.
//     Nothing hard was lost; the advisory surface is still reported as missing.
// Measured blast radius (2026-08-23, origin/main 538c41ed): 5 of the last 200
// commits on main touched a chain shard, so the blocking condition is reachable on
// ~2.5% of pushes AND only when the checker is simultaneously broken.
//
// ⛔ WHY NO CI-ONLY VARIANT. `check-chain-l2-contracts.mjs` is pure Node — no
// execSync, no network, no external binary, no WSL — so "could not run" here is
// exceptional (missing file / crash / OOM), NOT the environment-dependent absence
// SO #53 describes. CI therefore has no extra knowledge to condition on, a broken
// checker is ALREADY hard-caught there by the `Chain L2 contract-composition
// selftest` gate that imports it, and an env-conditional gate is precisely the
// local-vs-CI divergence SO #54 warns about. One rule, both environments.
//
// PURE by design: no I/O, no process.exit, no printing. That is what lets the
// self-test drive the REAL decision instead of a paraphrase of it (SO #34).
const L2_LEG_STATES = [
  'BLOCKED-COULD-NOT-RUN', // no verdict AND ≥1 touched chain — the leg did not fire over real subjects
  'BLOCKED-L2-FAIL',       // verdict says a touched chain carries an L2-fail edge
  'NO-VERDICT-NO-SUBJECT', // no verdict, but nothing touched — advisory loss only
  'CHECKED-CLEAN',         // every touched chain was assessed and none is L2-fail
  'CHECKED-INCOMPLETE',    // ≥1 touched chain absent from the report — assessed NOTHING about it
  'NO-SUBJECT',            // verdict present, this diff touches no chain shard
];

/**
 * Decide the L2 hard leg. ⛔ The ONLY place the blocking question is answered.
 * @param {null|{chains?: Array<{name:string,verdict:string,findings?:Array<{code:string}>}>}} rep
 *        the checker's parsed --json report, or null when it produced none
 * @param {Set<string>} touchedChainNames chain shard names added/edited in this diff
 * @returns {{state:string, block:boolean, subjects:string[],
 *            fails:Array<{name:string,findings:Array<{code:string}>}>, unassessed:string[]}}
 */
function decideL2HardLeg(rep, touchedChainNames) {
  const subjects = [...(touchedChainNames || [])].sort();
  if (!rep) {
    return subjects.length
      ? { state: 'BLOCKED-COULD-NOT-RUN', block: true, subjects, fails: [], unassessed: subjects }
      : { state: 'NO-VERDICT-NO-SUBJECT', block: false, subjects, fails: [], unassessed: [] };
  }
  const assessed = new Map((rep.chains || []).map((c) => [c.name, c]));
  // ⚠ Order matters: a diff touching BOTH a failing chain and an unassessed one
  // must still block on the failure rather than downgrade to "incomplete".
  const fails = subjects.map((n) => assessed.get(n)).filter((c) => c && c.verdict === 'L2-fail')
    .map((c) => ({ name: c.name, findings: c.findings || [] }));
  const unassessed = subjects.filter((n) => !assessed.has(n));
  if (fails.length) return { state: 'BLOCKED-L2-FAIL', block: true, subjects, fails, unassessed };
  if (!subjects.length) return { state: 'NO-SUBJECT', block: false, subjects, fails, unassessed };
  if (unassessed.length) return { state: 'CHECKED-INCOMPLETE', block: false, subjects, fails, unassessed };
  return { state: 'CHECKED-CLEAN', block: false, subjects, fails, unassessed };
}

/**
 * ADVISORY-CRASH-DISTINCT-1's control (SO #40b: prove RED before GREEN). Runs the
 * REAL classifier over REAL failed subprocesses and the REAL tally over a synthetic
 * ledger — it does not re-implement any of it. Hermetic: no network, no estate scan,
 * no filesystem writes, ~1s.
 */
function runSelfTest() {
  const failures = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  console.log('▶ preflight --self-test (ADVISORY-CRASH-DISTINCT-1: could-not-run is its own state'
    + ' · L2-HARDLEG-BLOCKING-1: could-not-run must not skip the hard leg)\n');

  console.log('RED — a checker that CANNOT RUN must classify as UNAVAILABLE:');
  for (const [name, cmd] of [
    ['missing script (module resolution)', 'node scripts/__advisory_crash_distinct_1_absent__.mjs'],
    ['missing binary (shell cannot execute)', '__advisory_crash_distinct_1_no_such_binary__ --check'],
    ['syntax error in the checker', 'node -e "const = ;"'],
    ['uncaught throw in the checker', 'node -e "throw new Error(\'acd1 self-test crash\')"'],
  ]) {
    const r = runAdvisoryChecker(cmd);
    check(name, r.state === 'UNAVAILABLE', `state=${r.state}${r.reason ? ` · ${r.reason}` : ''}`);
  }

  console.log('\nWARN — a checker that RAN and warned must stay a result, never UNAVAILABLE:');
  const warnCmd = 'node -e "console.error(\'gen-x --check: artifact is stale, re-run the generator\'); process.exit(1)"';
  const warned = runAdvisoryChecker(warnCmd);
  check('non-zero exit with a plain diagnostic', warned.state === 'WARNED', `state=${warned.state} · ${warned.reason}`);
  const fatal = runAdvisoryChecker('node -e "console.error(\'FATAL: 3 surface(s) out of sync\'); process.exit(2)"');
  check('deliberate FATAL diagnosis (exit 2)', fatal.state === 'WARNED', `state=${fatal.state} · ${fatal.reason}`);
  // FALSE-POSITIVE GUARDS. A finding that merely CONTAINS the words a shell uses
  // when it cannot execute something is still a finding — on stdout or stderr.
  const notFoundStdout = runAdvisoryChecker('node -e "console.log(\'registry/kernel/abc.json: not found\'); process.exit(1)"');
  check('a finding that says "not found" on stdout stays a result',
    notFoundStdout.state === 'WARNED', `state=${notFoundStdout.state} · ${notFoundStdout.reason}`);
  const notFoundStderr = runAdvisoryChecker('node -e "console.error(\'  x 3 declared artifact(s): not found\'); process.exit(1)"');
  check('a finding that says "not found" on stderr stays a result',
    notFoundStderr.state === 'WARNED', `state=${notFoundStderr.state} · ${notFoundStderr.reason}`);

  // Pinned fixtures: the VERBATIM stderr measured 2026-08-23 from two of the four
  // advisory-on-PR gates this row names. If a future widening of the crash rules
  // would reclassify a genuine single-writer staleness warning as "could not run",
  // it reds here instead of on somebody's push.
  const MEASURED = [
    ['CGSHARD-1 (assemble-chaingraph --check)',
      'DRIFT  chaingraph.json does NOT match assembled output from shards.\n'
      + '  committed length: 3432250, assembled length: 3432095\n'
      + '  first diff at byte 2855:\n'
      + '  HASH-NEUTRAL DRIFT — no hash can move here. The main-side derived-artifacts regen assembles and commits chaingraph.json after merge (SO #35 single writer).\n'
      + '  ASSEMBLY VERDICT: AUTO-LAND — node-modified 503-canton-tokenization-readiness-diagnostic\n'],
    ['REGISTRY-RESOLVE-STATIC-1 (gen-registry-kernel-resolve --check)',
      '✗ REGISTRY-RESOLVE-STATIC-1 kernel-resolve coverage FAILED — 1 problem(s):\n'
      + '  • stale 00bf25e2ac76c12d2bc9de448a1c9d767c67581310b599637d193d2f949b708a.json (on-disk content does not match recomputed record)\n\n'
      + 'Missing/stale (1) — regenerate: node scripts/gen-registry-kernel-resolve.mjs --write\n'],
    ['EUC-SITE-1 (gen-euc-register --check)',
      'gen-euc-register --check: 1 entries drifted from chaingraph.json, e.g. 503-canton-tokenization-readiness-diagnostic.register.json -- re-run `node scripts/gen-euc-register.mjs`\n'],
    ['kernel-VM explainer freshness (gen-kernel-vm-explainer --check)',
      'gen-kernel-vm-explainer --check: chaingraph/kernel-vm-explainer.html is out of sync with the generator.\nRun `node chaingraph/vm/scripts/gen-kernel-vm-explainer.mjs` to regenerate.\n'],
  ];
  for (const [name, stderr] of MEASURED) {
    const c = classifyExecFailure({ status: 1, signal: null, stdout: Buffer.from(''), stderr: Buffer.from(stderr) });
    check(`measured red stays advisory: ${name}`, c.ran === true, `ran=${c.ran} · ${c.reason}`);
  }

  // ── L2-HARDLEG-BLOCKING-1 controls ────────────────────────────────────────
  // Drives the REAL decideL2HardLeg() — the same function the live L2 block calls
  // — over synthetic reports. Hermetic: no checker is spawned, no estate is read.
  // ⚠⚠ THE FIRST CONTROL IS THE ROW. On origin/main (538c41ed) this function does
  // not exist and the equivalent path printed `✗ UNAVAILABLE` and let the push
  // through; here it must BLOCK.
  console.log('\nL2 HARD LEG — a checker that could not run must not let a touched chain through (L2-HARDLEG-BLOCKING-1):');
  const repClean = { chains: [{ name: 'alpha-chain', verdict: 'L2-pass', findings: [] }] };
  const repFail = {
    chains: [
      { name: 'alpha-chain', verdict: 'L2-pass', findings: [] },
      { name: 'rtp-participation', verdict: 'L2-fail', findings: [{ code: 'shared-input-domain-disjoint' }] },
    ],
  };
  const dNoRunTouched = decideL2HardLeg(null, new Set(['alpha-chain']));
  check('RED — no verdict + a touched chain shard ⇒ BLOCKS',
    dNoRunTouched.block === true && dNoRunTouched.state === 'BLOCKED-COULD-NOT-RUN',
    `state=${dNoRunTouched.state} block=${dNoRunTouched.block} unassessed=${dNoRunTouched.unassessed.join(',')}`);
  const dNoRunUntouched = decideL2HardLeg(null, new Set());
  check('GREEN — no verdict + NO touched chain ⇒ does NOT block (a broken checker must not red every push)',
    dNoRunUntouched.block === false && dNoRunUntouched.state === 'NO-VERDICT-NO-SUBJECT',
    `state=${dNoRunUntouched.state} block=${dNoRunUntouched.block}`);
  const dFail = decideL2HardLeg(repFail, new Set(['rtp-participation']));
  check('RED — checker ran, a TOUCHED chain carries an L2-fail edge ⇒ BLOCKS',
    dFail.block === true && dFail.state === 'BLOCKED-L2-FAIL' && dFail.fails[0].name === 'rtp-participation',
    `state=${dFail.state} fails=${dFail.fails.map((f) => f.name).join(',')}`);
  const dFailUntouched = decideL2HardLeg(repFail, new Set());
  check('ADVISORY PRESERVED — the same L2-fail chain UNTOUCHED ⇒ does NOT block (rest of L2 stays advisory)',
    dFailUntouched.block === false && dFailUntouched.state === 'NO-SUBJECT',
    `state=${dFailUntouched.state} block=${dFailUntouched.block}`);
  const dBoth = decideL2HardLeg(repFail, new Set(['rtp-participation', 'not-in-report']));
  check('RED wins — a touched failure plus a touched unassessed chain still blocks on the failure',
    dBoth.block === true && dBoth.state === 'BLOCKED-L2-FAIL' && dBoth.unassessed.includes('not-in-report'),
    `state=${dBoth.state} unassessed=${dBoth.unassessed.join(',')}`);
  const dClean = decideL2HardLeg(repClean, new Set(['alpha-chain']));
  check('GREEN — a touched chain assessed L2-pass ⇒ does NOT block',
    dClean.block === false && dClean.state === 'CHECKED-CLEAN' && dClean.unassessed.length === 0,
    `state=${dClean.state} block=${dClean.block}`);
  const dIncomplete = decideL2HardLeg(repClean, new Set(['brand-new-chain']));
  check('NOT SILENT — a touched chain absent from the report reports CHECKED-INCOMPLETE, never "checked, none L2-fail"',
    dIncomplete.block === false && dIncomplete.state === 'CHECKED-INCOMPLETE'
      && dIncomplete.unassessed.join(',') === 'brand-new-chain',
    `state=${dIncomplete.state} unassessed=${dIncomplete.unassessed.join(',')}`);
  const legStates = [dNoRunTouched, dNoRunUntouched, dFail, dFailUntouched, dBoth, dClean, dIncomplete]
    .map((d) => d.state);
  check('every leg outcome is a DECLARED state — no unnamed path where the leg neither fires nor reports',
    legStates.every((s) => L2_LEG_STATES.includes(s))
      && new Set(legStates).size === L2_LEG_STATES.length,
    `${new Set(legStates).size}/${L2_LEG_STATES.length} declared states exercised`);

  console.log('\nACCOUNTING — every state is categorised, and an unknown state is DETECTED:');
  const ledger = RESULT_STATES.map((s) => ({ label: `synthetic ${s}`, state: s, ms: 0 }));
  const full = tallyResults(ledger);
  check('one of every state is fully accounted for',
    full.accounted === ledger.length && full.uncategorised === 0,
    `accounted=${full.accounted}/${ledger.length} uncategorised=${full.uncategorised}`);
  check('ADVISORY and UNAVAILABLE are counted, not dropped',
    full.counts.ADVISORY === 1 && full.counts.UNAVAILABLE === 1,
    `ADVISORY=${full.counts.ADVISORY} UNAVAILABLE=${full.counts.UNAVAILABLE}`);
  const rogueLedger = [...ledger, { label: 'synthetic rogue', state: 'SOMETHING-NEW', ms: 0 }];
  const rogue = tallyResults(rogueLedger);
  check('an unknown state fails the reconciliation instead of being absorbed (RED control)',
    rogue.uncategorised === 1 && rogue.accounted !== rogueLedger.length,
    `uncategorised=${rogue.uncategorised} accounted=${rogue.accounted} of ${rogueLedger.length}`);

  console.log('\nSUMMARY — the UNAVAILABLE count reaches the final summary line:');
  check('clause present when an advisory could not run', /UNAVAILABLE/.test(unavailableClause(2)), unavailableClause(2).trim());
  check('clause absent when every advisory reported', unavailableClause(0) === '', '(empty)');

  // END-TO-END RENDERER PROOF. Drives the REAL reporting path — the same
  // gateUnavailable() and printUnavailableBlock() the live advisories call — over a
  // REAL failed subprocess, so what a session would actually see is printed here
  // verbatim rather than described.
  console.log('\nRENDERER — a live could-not-run advisory, rendered through the production path:');
  const rendered = runAdvisoryChecker('node scripts/__advisory_crash_distinct_1_absent__.mjs');
  gateStart('synthetic advisory checker (self-test)');
  gateUnavailable('synthetic advisory checker (self-test)', rendered.reason, '');
  printUnavailableBlock();
  console.log(`\n  the final summary line then reads:\n  ✅ preflight PASSED — all hard CI gates green. Safe to push.${unavailableClause(unavailableAdvisories.length)}`);
  check('the unavailable advisory reached the summary roll-up', unavailableAdvisories.length === 1,
    `${unavailableAdvisories.length} recorded`);
  unavailableAdvisories.length = 0; // self-test only — never leaks into a real run

  console.log('');
  if (failures.length) {
    console.error(`❌ preflight --self-test FAILED: ${failures.length} control(s) red:`);
    for (const f of failures) console.error(`   ✗ ${f}`);
    return 1;
  }
  console.log('✅ preflight --self-test PASSED — could-not-run, ran-and-warned and the result accounting are all');
  console.log('   distinguishable, and the L2 hard leg blocks rather than silently skipping when its checker cannot run.');
  return 0;
}

if (process.argv.includes('--self-test')) process.exit(runSelfTest());

// HELMGATE-DECOUPLE-1 (2026-07-31): the 4 helm drift/freshness gates below
// assert helm.html against helm/version.json + helm/guide-freshness.json —
// state that goes stale on a schedule set by a SEPARATE repo's release job,
// not by anything in a given site push. Blocking every unrelated site push
// on that staleness caused --no-verify once already (board/done/AVAX-PERM-1.md)
// and blocked PR #766. Scope them to pushes that actually touch helm-relevant
// paths — the release job's own push to helm/version.json IS such a push, so
// the gate still fires exactly where drift can originate; a PR touching only
// tools/guides/kernels never trips it. Undeterminable (e.g. no git history to
// diff) fails OPEN (gates still run) — this narrows blast radius, it never
// weakens what the gate itself checks.
function helmPathsTouched() {
  const isHelmPath = (f) => f === 'helm.html' || f.startsWith('helm/') ||
    f === 'scripts/check-helm-version-drift.mjs' || f === 'scripts/gen-helm-guide-freshness.mjs';
  try {
    const touched = new Set();
    execSync('git diff --name-only HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    execSync('git diff --name-only --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    try {
      const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      execSync(`git diff --name-only ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').forEach(f => f && touched.add(f));
    } catch { /* no upstream configured — local/staged diff above is what we have */ }
    return [...touched].some(isHelmPath);
  } catch {
    return true; // can't determine — fail open, run the gates
  }
}
const HELM_SCOPE_TOUCHED = helmPathsTouched();

// FV-FLOOR-DIGEST-GATE-1: which __proptests__/*.proptest.mjs floor files this push touches, for the
// --verify-authoring scoped check below. Same union-of-diffs shape as helmPathsTouched() above (working
// tree + staged + committed-vs-upstream, deduped via a Set) — reused, not reinvented. UNLIKE
// helmPathsTouched(), an undeterminable diff fails CLOSED (empty list, gate no-ops) rather than open: this
// check's entire design is "scoped to the diff, never the full estate" (a floor file legitimately goes
// stale later when its kernel moves — see check-fv-floor-coverage.mjs's header comment), so falling back to
// "examine everything" on an undeterminable diff would be exactly the widening that design forbids.
function touchedFloorFiles() {
  const isFloorFile = (f) => /^chaingraph\/kernels\/__proptests__\/[^/]+\.proptest\.mjs$/.test(f);
  try {
    const touched = new Set();
    execSync('git diff --name-only --diff-filter=ACM HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    execSync('git diff --name-only --diff-filter=ACM --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    try {
      const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      execSync(`git diff --name-only --diff-filter=ACM ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').forEach(f => f && touched.add(f));
    } catch { /* no upstream configured — working tree/staged diff above is what we have */ }
    return [...touched].filter(isFloorFile);
  } catch {
    return []; // undeterminable — fail CLOSED (empty, not a full-estate fallback); see comment above
  }
}
const TOUCHED_FLOOR_FILES = touchedFloorFiles();

// JSDOC-CHECKJS-PREFLIGHT-1: which chaingraph/kernels/**/*.mjs files this push
// touches, for the JSDoc CheckJS gate below. Same selection rule as
// .github/workflows/jsdoc-checkjs.yml's "List new/touched kernel files" step
// (diff-filter ACM against a base), and the same union-of-diffs shape as
// touchedFloorFiles() above (working tree + staged + committed-vs-upstream,
// deduped via a Set) — reused, not reinvented. Undeterminable fails CLOSED
// (empty list, gate no-ops), same reasoning as touchedFloorFiles(): a diff
// this can't compute is not license to sweep the whole kernel estate.
function touchedKernelFilesForJsdoc() {
  const isKernelMjs = (f) => f.startsWith('chaingraph/kernels/') && f.endsWith('.mjs');
  try {
    const touched = new Set();
    execSync('git diff --name-only --diff-filter=ACM HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    execSync('git diff --name-only --diff-filter=ACM --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    try {
      const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      execSync(`git diff --name-only --diff-filter=ACM ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').forEach(f => f && touched.add(f));
    } catch { /* no upstream configured — working tree/staged diff above is what we have */ }
    return [...touched].filter(isKernelMjs);
  } catch {
    return []; // undeterminable — fail CLOSED (empty, not a full-estate fallback)
  }
}
const TOUCHED_KERNEL_FILES_JSDOC = touchedKernelFilesForJsdoc();

// KERNEL-PREFLIGHT-1: kernel ids touched by this push, derived from the SAME
// TOUCHED_KERNEL_FILES_JSDOC set above (reused, not recomputed — one git-diff pass,
// not two) — one kernel-preflight.mjs run per id, so push-time gets the SAME
// per-kernel check a K session already ran while authoring (no drift between
// author-time and push-time, per the row's own wiring requirement).
function touchedKernelIdsFromJsdocSet(files) {
  const KERNEL_RE = /^chaingraph\/kernels\/([^/]+)\.kernel\.mjs$/;
  const PROPTEST_RE = /^chaingraph\/kernels\/__proptests__\/([^/]+)\.proptest\.mjs$/;
  const ids = new Set();
  for (const f of files) {
    const k = f.match(KERNEL_RE);
    if (k) ids.add(k[1]);
    const p = f.match(PROPTEST_RE);
    if (p) ids.add(p[1]);
  }
  return [...ids].sort();
}
const TOUCHED_KERNEL_IDS = touchedKernelIdsFromJsdocSet(TOUCHED_KERNEL_FILES_JSDOC);

// SITEMAP-MAIN-REGEN-1 (SO #28 / SO #35): freshness gates for SHARED DERIVED
// ARTIFACTS are ADVISORY in a PR context and BLOCKING in a main context.
//
// WHY THE SPLIT: SO #35 makes those artifacts single-writer — a shard row is now
// FORBIDDEN to regenerate them, because every shard rewriting the same files
// pushed its still-open siblings into conflict, which destroyed their merge ref
// and SILENTLY REMOVED THEIR CI (SO #34c; PR #1199 lived its whole life ungated).
// A gate a branch is forbidden to satisfy must not block that branch. Ownership
// moves to main: derived-artifacts-regen.yml regenerates and commits any drift
// there, and these gates stay hard on main so drift can never survive.
//
// ⛔ NO CHECK IS DELETED, AND NONE IS SKIPPED. Every gate below still RUNS in
// both contexts and still prints its full failure output; only the exit-code
// handling differs. A session that forgot regen entirely still sees the warning.
//
// isMainContext() FAILS CLOSED — anything undeterminable blocks. The downgrade
// has to be affirmatively earned, never inherited from a failed lookup.
const { advisoryGates, isMainContext, COVERED } = await import('./derived-artifacts.mjs');

// DERIVED-SET-SELFTEST-1: which files this push touches, for the live regen
// self-test's scoping below. It ACTUALLY EXECUTES every declared regen command
// in a scratch worktree (2-3 minutes over the full COVERED list) — too slow to
// run on every push, so it is scoped to pushes that could plausibly move the
// answer: an edit to derived-artifacts.mjs itself, or to any generator/gate
// script a COVERED entry names. `primaryScriptPath` is the SAME lexical
// extractor check-derived-declare-parity.mjs's static analysis already uses
// (reused, not reimplemented) — it returns the first non-interpreter token of
// a regen/gate command, e.g. 'scripts/gen-x.mjs' out of 'node scripts/gen-x.mjs
// --write'. Same union-of-diffs shape as helmPathsTouched() above (working
// tree + staged + committed-vs-upstream, deduped via a Set); undeterminable
// fails OPEN (gate runs) — the live scan is read/write-scoped to a throwaway
// worktree, never the shared tree, so running it unnecessarily costs time, not
// correctness, which is the same tradeoff helmPathsTouched() already makes.
const { primaryScriptPath } = await import('./check-derived-declare-parity.mjs');
function derivedRegenLiveScopeTouched() {
  const relevant = new Set(['scripts/derived-artifacts.mjs']);
  for (const c of COVERED) {
    const rp = primaryScriptPath(c.regen);
    if (rp) relevant.add(rp);
    if (c.gate) { const gp = primaryScriptPath(c.gate); if (gp) relevant.add(gp); }
  }
  try {
    const touched = new Set();
    execSync('git diff --name-only HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    execSync('git diff --name-only --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
    try {
      const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      execSync(`git diff --name-only ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').forEach(f => f && touched.add(f));
    } catch { /* no upstream configured — working tree/staged diff above is what we have */ }
    return [...touched].some((f) => relevant.has(f));
  } catch {
    return true; // undeterminable — fail open, run the gate
  }
}
const DERIVED_REGEN_LIVE_SCOPE_TOUCHED = derivedRegenLiveScopeTouched();
const MAIN_CONTEXT = isMainContext();
const ADVISORY_ON_PR = advisoryGates();

// MERGEQUEUE-GATE-PARITY-1: a CI run in a MAIN context (push to main, schedule)
// runs the suite to COMPLETION, not fail-fast.
//
// WHY: preflight's default is fail-fast, so a red main reports exactly ONE gate
// and conceals every gate after it. Measured on the 2026-08-22/23 red main — the
// EUC register freshness gate was first-failure and masked the debt-ledger
// freshness gate entirely; clearing the first one in PR #1486 did not turn main
// green, it merely promoted the next red into view. "main is red" was never a
// count of one, and the log said it was, so a fix-forward was aimed at a
// one-item list that was not the real list.
//
// ⛔ NOT A WAIVER, and no gate's semantics move: every gate runs with the
// identical predicate either way, EXPECTED-RED requires an explicit
// --expect-red (never passed by CI, so nothing is waived), any unwaived red
// still exits 1, and the run-list accounting reconciliation FAILS CLOSED if a
// gate produced no result at all. Cost is identical on a green run — the same
// gates execute; it costs more only when main is ALREADY red, which is exactly
// when the complete inventory is worth paying for.
//
// ⚖ Scoped to CI: a local pre-push run is untouched and stays fail-fast (fast
// feedback while iterating). PR and merge_group runs are untouched too — a red
// there blocks the branch anyway and the author iterates, so first-red is the
// cheaper signal. This lives here rather than as a `--keep-going` argument in
// scripts-verify.yml on purpose: the merge App has no `workflows` permission, so
// a PR touching .github/workflows/** cannot be merged by the automerge label at
// all (measured 2026-08-23, run 32647684237: "refusing to allow a GitHub App to
// create or update workflow ... without `workflows` permission"). Keeping the
// decision beside the logic it governs also means the local and CI meanings of
// "run to completion" can never drift apart in two files.
if (!KEEP_GOING && MAIN_CONTEXT && process.env.GITHUB_ACTIONS === 'true') {
  KEEP_GOING = true;
  console.log('▶ CI main context — running the full suite to completion (a red main is never a count of one).');
}

// [label, command] — exact CI hard gates, in CI order, + the hub-freshness gate.
const GATES = [
  // L2-HARDLEG-BLOCKING-1: preflight's OWN reporting controls, run as a gate so they
  // cannot rot unrun. `--self-test` exits before this array is even built, so there is
  // no recursion and no gate runs twice — it costs ~1s, spawns only synthetic
  // subprocesses, reads no estate file and writes nothing. It proves the classifier
  // (ADVISORY-CRASH-DISTINCT-1) still tells could-not-run from ran-and-warned, and that
  // the L2 hard leg blocks instead of silently skipping when its checker cannot run.
  ['Preflight reporting self-test (ADVISORY-CRASH-DISTINCT-1 + L2-HARDLEG-BLOCKING-1)',
    'node scripts/preflight.mjs --self-test'],
  // BINARY-BYTE-GATE-1 runs FIRST, ahead of the JS syntax gate, on purpose.
  // The syntax gate is structurally BLIND to this class: DISE-SEG-T-2 shipped a
  // raw NUL inside a JS string delimiter in tools/582 and check_tools.js was
  // green both before and after the fix, because a NUL in a string literal is
  // valid JavaScript. Worse, that NUL makes the file read as BINARY to grep and
  // ripgrep, so every grep-based gate below silently stops matching it. A file
  // that has gone invisible to the instruments must be caught before anything
  // downstream reports a green it cannot actually see.
  ['Binary/control bytes (BINARY-BYTE-GATE-1)', 'node scripts/check-binary-bytes.mjs'],
  ['Binary-byte gate fixture proof', 'node scripts/check-binary-bytes.test.mjs'],
  ['JS syntax (tool HTML)',        'node scripts/check_tools.js'],
  ['Kernel JS syntax',             'node chaingraph/kernels/syntax-check.mjs'],
  // JSDOC-CHECKJS-PREFLIGHT-1: runs the SAME script + SAME npx-fetched tsc pin as
  // .github/workflows/jsdoc-checkjs.yml (jsdoc-checkjs-gate.mjs hardcodes the pin —
  // one SSOT, nothing duplicated here), scoped to the same touched-kernel-file
  // selection rule (TOUCHED_KERNEL_FILES_JSDOC above). Zero touched files ⇒
  // explicit "0 touched, skipped" line, never silence. npx unavailable/offline ⇒
  // jsdoc-checkjs-gate.mjs itself fails loudly (tsc exits non-zero with no
  // parseable diagnostics is treated as a hard failure, not a silent pass).
  ['JSDoc CheckJS (touched kernels, JSDOC-CHECKJS-PREFLIGHT-1)',
    TOUCHED_KERNEL_FILES_JSDOC.length
      ? `node scripts/jsdoc-checkjs-gate.mjs ${TOUCHED_KERNEL_FILES_JSDOC.map((f) => `"${f}"`).join(' ')}`
      : 'node -e "console.log(\'0 touched, skipped\')"',
    TOUCHED_KERNEL_FILES_JSDOC.length
      ? null
      : { notRun: 'this push touches no chaingraph/kernels/**/*.mjs file, so the JSDoc CheckJS gate had nothing to examine' }],
  ['JSDoc CheckJS fixture proof (classifyDiagnostics, TOUCHTAX-DIFFSCOPE-1)', 'node scripts/jsdoc-checkjs-gate.test.mjs'],
  ['Kernel exports (meta+compute)','node scripts/check-kernel-exports.mjs'],
  ['Forbidden-hash lint',          'node chaingraph/kernels/lint-forbidden-hash.mjs'],
  ['Hash golden-parity',           'node chaingraph/kernels/golden-parity.test.mjs'],
  ['Kernel-identity monolith upsert controls (GENKERNELID-UPSERT-FIX-1)', 'node chaingraph/kernels/gen-kernel-identity.test.mjs'],
  ['Determinism replay (N=3 + JCS)', 'node chaingraph/kernels/determinism-replay.test.mjs'],
  ['VM↔worker parity (§24)',       'node chaingraph/kernels/vm-parity-gate.mjs --strict'],
  ['Guest builtin safety (GUEST-BUILTIN-GATE-1)', 'node chaingraph/kernels/check-guest-builtin-safety.mjs'],
  ['Guest builtin safety controls (canary + mutation)', 'node chaingraph/kernels/check-guest-builtin-safety.test.mjs'],
  ['Kernel empty-input finite',    'node chaingraph/kernels/empty-input-finite.test.mjs'],
  ['Quantization parity (§24.6)',  'node chaingraph/kernels/quantization-parity.test.mjs'],
  ['Seed replay (§24.6.2)',        'node chaingraph/kernels/seed-replay.test.mjs'],
  ['Kernel determinism lint',      'node scripts/check-kernel-determinism.mjs'],
  // FAIL-CLOSED-PARITY-LINT-1 (J24 L1 lint-family batch): a year-keyed pinned-table lookup
  // that silently falls back onto a default row answers a 2019 question with 2026 numbers
  // and 2026 citations -- worse than an error: a wrong answer that looks retrieved, and
  // reproduces. Detects the same-table default-row fallback shape in
  // chaingraph/kernels/*.kernel.mjs and ratchets it to zero via
  // scripts/year-fallback-parity-baseline.json (art-218:115, art-234:85 and art-365:68
  // pinned; their fix belongs to REGZ-CORRECTION-APPLY-1, PR #1502). Vocabulary:
  // LOOKUP_YEAR_UNAVAILABLE (registered NOT_EVALUABLE alias, subcode NOT_EVALUABLE-LOOKUP).
  // Paired red-proof (SO #40b / GATE-SELFTEST-META-1): the fixture proof entry below.
  ["Year-fallback parity lint (FAIL-CLOSED-PARITY-LINT-1)", "node scripts/check-year-fallback-parity.mjs"],
  ["Year-fallback parity lint fixture proof (SO #40b pairing)", "node scripts/check-year-fallback-parity.test.mjs"],
  ["Floor label strength lint (FLOOR-LABEL-LINT-1)", "node scripts/check-floor-label-strength.mjs"],
  ["Floor label strength lint fixture proof (SO #40b pairing)", "node scripts/check-floor-label-strength.test.mjs"],
  ["Narrative vocab lint (NARRATIVE-VOCAB-LINT-1)", "node scripts/check-narrative-vocab.mjs"],
  ["Narrative vocab lint fixture proof (SO #40b pairing)", "node scripts/check-narrative-vocab.test.mjs"],
  ["Frozen clock lint (NO-CLOCK-LINT-1)", "node scripts/lint-frozen-clock.mjs"],
  ["Frozen clock lint fixture proof (SO #40b pairing)", "node scripts/lint-frozen-clock.test.mjs"],
  // KERNEL-PREFLIGHT-1: one entry per kernel id touched by this push (TOUCHED_KERNEL_IDS
  // above) — the FULL per-kernel composite (syntax/exports/hash-lint/guest-builtin/VM-
  // parity/tsc/proptest-floor/registration/hub-categories/node-page/clause-digest), not
  // just the tsc leg the JSDoc CheckJS gate above already covers. No-ops (DID-NOT-RUN
  // under --keep-going) when this push touches no kernel/floor file.
  ...(TOUCHED_KERNEL_IDS.length
    ? TOUCHED_KERNEL_IDS.map((id) => [`Kernel preflight (${id})`, `node scripts/kernel-preflight.mjs ${id}`])
    : [['Kernel preflight (KERNEL-PREFLIGHT-1: no kernel/floor file touched, skipped)', 'node -e "1"',
        { notRun: 'KERNEL-PREFLIGHT-1 scoping — this push touches no chaingraph/kernels/*.kernel.mjs or __proptests__/*.proptest.mjs, so no per-kernel check was run' }]]),
  // NODE-COMPLETENESS-GATE-1: is a node WHOLE, not just individually-fenced-clean —
  // identity freshness, registration, url resolution, node-page-or-pageless, fixtures+
  // proptest, all recomputed from primary sources (SO #34). --all-changed does its OWN
  // git-diff-vs-origin/main scoping to chaingraph/graph/nodes/*.json and
  // chaingraph/kernels/*.kernel.mjs internally (see scripts/check-node-complete.mjs), so
  // this single entry self-scopes — no touched-file plumbing needed here.
  ['Node completeness (NODE-COMPLETENESS-GATE-1)', 'node scripts/check-node-complete.mjs --all-changed'],
  // OCG §NODEPAGE-1 (SCHEMA-PAGELESS-FIELD-1): `pageless` is a WAIVER, so its truth is
  // RECOMPUTED from the filesystem, never trusted (SO #34). Sweeps every shard AND the
  // assembled catalog rather than only touched files — art-662's false declaration was
  // invisible to every shard-level check and only surfaced at assembly, as an INVALID
  // chaingraph.json. Whole-estate is affordable: the sweep costs one stat per declaration
  // and the estate normally carries zero.
  ['§NODEPAGE-1 pageless consistency', 'node chaingraph/standard/check-pageless-consistency.mjs --quiet'],
  ['§NODEPAGE-1 pageless controls (RED+GREEN)', 'node chaingraph/standard/pageless-consistency.test.mjs'],
  // WARN-ONLY BY DESIGN (PAGEDET-GATE-1): 28 pre-existing page defects are
  // baselined, and the flag makes even a NEW one report rather than block. A gate
  // that reds main on a pre-existing condition gets switched off; this one is here
  // to be read. Drop --warn-only once the baseline is worked down.
  ['Page determinism (preimage-reachable, warn-only)', 'node scripts/check-page-determinism.mjs --warn-only',
    { note: 'runs with --warn-only, which exits 0 even on a new defect — a green here reports, it does not verdict' }],
  ['Page determinism gate controls', 'node scripts/check-page-determinism.test.mjs'],
  ['Kernel index current',         'node chaingraph/kernels/gen-index.mjs --check'],
  // REGISTRY-RESOLVE-STATIC-1: positive-half kernel_digest -> spec_digest resolution
  // records (registry/kernel/<hex>.json). NODE-FANOUT-REGEN-CLOSE-1 (2026-08-21)
  // moved this INTO the SO #28/#35 shared derived set (derived-artifacts.mjs COVERED
  // id 'registry-kernel-resolve'), so the generic ADVISORY_ON_PR categorisation now
  // downgrades it on a PR and keeps it blocking on main, exactly like every other
  // shared artifact. It is no longer "sole writer, always blocking": a node
  // registration drifted it on all three of 2026-08-21's registrations, and SO #35
  // forbids the PR that caused the drift from repairing it.
  ['Registry kernel-resolve current (REGISTRY-RESOLVE-STATIC-1)', 'node scripts/gen-registry-kernel-resolve.mjs --check'],
  // GENERATOR-PRUNES-ORPHANS-1: --write now PRUNES the orphans it owns, so the
  // six prune controls (PRUNE GREEN / CAP RED / real-event pass / NOT-MINE /
  // idempotent / unchanged) need a runner or they are a gate that never fires.
  // Hard here, and therefore hard in scripts-verify / required, which runs this
  // whole suite (SO #54: advisory locally is not evidence of advisory in CI —
  // here the reverse, and it is the reason this line is not enough on its own
  // to be called "covered" without saying which context runs it).
  ['Kernel-resolve prune controls (GENERATOR-PRUNES-ORPHANS-1)', 'node scripts/gen-registry-kernel-resolve.test.mjs'],
  // FV-AGENTSURFACE-BUILD-1: unified FV-status artifact per spec_digest. Also moved
  // into the shared derived set by NODE-FANOUT-REGEN-CLOSE-1 (COVERED id 'fv-status'),
  // same advisory-on-PR / blocking-on-main split as the gate above.
  ['FV-status artifact current (FV-AGENTSURFACE-BUILD-1)', 'node scripts/gen-fv-status.mjs --check'],
  ['Kernel coverage (node↔index)', 'node scripts/check-kernel-coverage.mjs'],
  ['Hash art-01 parity',           'node chaingraph/kernels/parity-art-01.test.mjs'],
  ['Inline hash equality (AUD-C3)', 'node chaingraph/kernels/inline-hash-equality.test.mjs'],
  ['Ed25519 noble↔WebCrypto equivalence (FV-ED25519-NOBLE-1)', 'node chaingraph/kernels/ed25519-webcrypto-equivalence.test.mjs'],
  ['Canon block ordering (CANON-ORDER-1)', 'node scripts/check-canon-order.mjs'],
  // INLINE-SSOT-PORTS-GATE-1: the self-test runs FIRST and is not optional. It
  // asserts, with negative controls, that the codeOnly normalizer still fails on
  // a changed operator/constant/identifier/string — a normalizer that quietly
  // widened would turn the sync check below green over a real divergence, so a
  // green sync check means nothing unless the normalizer itself is proven narrow.
  ['Inline SSOT normalizer self-test (INLINE-SSOT-PORTS-GATE-1)', 'node scripts/check-inline-ssot-sync.mjs --self-test'],
  ['Inline SSOT sync (INLINESYNC-1)', 'node scripts/check-inline-ssot-sync.mjs --check'],
  ['DAG helper resolvability (ESCDAG-FIX-1)', 'node scripts/check-dag-idents.mjs'],
  ['Index sync (tools↔homepage)',  'python scripts/check_index_sync.py --strict --no-color'],
  // SSOTPREFLIGHT-WIRE-1 (2026-07-27): registry of the 6 SSOT-writing producers
  // this gate defends against (SSOTGUARD-VERIFY-1). None of the 6 has a --check
  // flag or idempotency guard of its own — this gate is the only thing standing
  // between them and a malformed chaingraph.json/chaingraph.meta.json landing on
  // main, so their names are recorded here for traceability even though the gate
  // command below doesn't take arguments naming them.
  //   scripts/patch-wave38.mjs              — direct chaingraph.json writeFileSync
  //   scripts/add-wave43-nodes.mjs          — direct chaingraph.json writeFileSync
  //   scripts/add-cc-g-tvm-nodes.mjs        — direct chaingraph.json writeFileSync
  //   scripts/add-rhc-wave-a-nodes.mjs      — direct chaingraph.json writeFileSync
  //   scripts/add-rhc-wave-b-node.mjs       — direct chaingraph.json writeFileSync
  //   scripts/migrate-chaingraph-shards.mjs — writes chaingraph.meta.json + shards,
  //     NOT chaingraph.json directly. Same gate still covers it: assemble-chaingraph.mjs
  //     reads chaingraph.meta.json (META_PATH) as its input and diffs the assembled
  //     result against the committed chaingraph.json (CG_PATH) — a meta.json/shard
  //     corruption from this script surfaces as an assemble --check mismatch exactly
  //     like a direct-appender divergence would. One gate, two write targets, reasoned
  //     not assumed (assemble-chaingraph.mjs META_PATH read + CG_PATH diff).
  // ⚠ This registry is documentation, not enforcement, and does NOT close the
  // `--no-verify` bypass — the pre-push hook (and this gate) simply doesn't run
  // if a push skips hooks.
  // ASSEMBLE-MAINSIDE-1 (SO #35 extended, 2026-08-20): chaingraph.json is now a
  // SHARED DERIVED ARTIFACT (derived-artifacts.mjs COVERED id 'chaingraph-assemble')
  // — the main-side regen workflow assembles + commits it after a single-node/
  // small-additive merge, same writer pattern as catalogs/sitemap. This exact
  // command string is also that entry's `gate`, so the generic ADVISORY_ON_PR
  // categorisation above downgrades it to advisory-on-PR automatically — no PR
  // ever regenerates chaingraph.json again. It stays BLOCKING on main. Node
  // removals/renames and any graph/chains/ change are OUT of the auto-writer's
  // scope (the assembler itself refuses those, no-write/no-commit) and still
  // land via an explicit ASSEMBLE/LAND row.
  // ⚖ AMENDED by ASSEMBLE-CHAIN-CLASSIFY-1 (2026-08-22): the all-or-nothing
  // chain refusal is now three verdicts — copy-only chain edits (description/
  // title only) and purely additive new chains AUTO-LAND; structural chain
  // edits, chain removals/renames and node removals/renames are still REFUSED
  // to a human ASSEMBLE/LAND row, and a refusal is no longer a silent exit 0
  // (assemble-chaingraph.mjs --refusal-status, run last by the regen workflow).
  ['chaingraph.json shard freshness (CGSHARD-1)', 'node scripts/assemble-chaingraph.mjs --check'],
  ['Assembly classifier verdict proof (ASSEMBLE-CHAIN-CLASSIFY-1)', 'node scripts/assemble-chaingraph.selftest.mjs'],
  ['Node/chain shard registration (NODE-REGISTRATION-GAP-1, node case blocking)', 'node scripts/check-shard-assembly.mjs'],
  ['Branch-aware shard-registration proof (SHARD-GATE-PRE-ASSEMBLE-1)', 'node scripts/check-shard-assembly.test.mjs'],
  ['Unassembled-shard diff fixture proof (CHAINORDER-GATE-1)', 'node scripts/lib-shard-order.test.mjs'],
  // SANDBOX-FILELIST-GATE-1: check-shard-assembly.test.mjs (above) and
  // check-nav-reachability.test.mjs (below) copy real modules into throwaway fixture
  // repos. That copy list used to be hand-maintained with nothing behind it, and one
  // added import took the whole suite out twice in two days (PR #1492: 13 of 18 red;
  // PR #1498: all 18 ERR_MODULE_NOT_FOUND) — each time reading as "my change broke
  // everything" rather than as lost coverage, and each caught by a before/after diff
  // rather than by the change itself. The list is now DERIVED from the real import
  // graph by scripts/lib-sandbox-deps.mjs; this gate is the RED half that keeps the
  // derivation and its named diagnosis honest, and it carries the parity check that
  // the derived set still equals the pre-conversion hand list for both harnesses.
  ['Derived sandbox file set (SANDBOX-FILELIST-GATE-1)', 'node scripts/lib-sandbox-deps.test.mjs'],
  // RECONCILE-PUSH-QUARANTINE-1: the pre-push guard that quarantines reconcile-class
  // ref creation to refs/heads/wip/, plus the supersession classifier that replaces
  // `git cherry`. The guard itself runs from .githooks/pre-push, which is per-clone
  // config and therefore invisible to CI — this gate is what keeps its decision
  // logic from silently rotting. Hermetic: pure functions driven by fixtures
  // recorded from the 2026-08-22 incident, no network and no `gh`.
  ['Reconcile push-quarantine controls (RED/GREEN/UNCHANGED/CLASSIFIER)', 'node scripts/reconcile-guard.test.mjs'],
  // XSURF-CHECKER-1: five-leg cross-surface fact-consistency detector. The only
  // two surface pairs in the estate that never drift are the two with a single
  // mechanical writer; every hand-maintained pair drifts, and until this gate
  // nothing watched. Legs (a) page<->kernel payload strings, (c) flag-ghost,
  // (d) kernel-meta<->shard mcp_name are BLOCKING against a down-only baseline.
  // Leg (b) (register digest) is REPORT-ONLY by ruling — it prints its count and
  // contributes nothing to the exit code. Also wired into land-verify.yml
  // (kernel/shard paths) and html-verify.yml (page paths), so the gate cannot
  // become preflight-only: that divergence class has bitten this estate twice.
  ['Cross-surface fact consistency (XSURF-CHECKER-1)', 'node scripts/check-cross-surface.mjs'],
  ['Cross-surface detector self-tests (SO #34 mutation control)', 'node scripts/check-cross-surface.test.mjs'],
  // Rule-registry: the assembled table is an SO #35 single-writer derived artifact (ASSEMBLE-LAND
  // only). --check recomputes every entry's source digest from the pinned snapshot bytes, so a
  // shard row's entry file is verified here even while the table itself is still PENDING-ASSEMBLE.
  ['Rule-registry table freshness (ACCT-RULEREG-K-1)', 'node scripts/gen-rule-registry.mjs --check'],
  ['Rule-registry generator mutation control (SO #34)', 'node scripts/gen-rule-registry.test.mjs'],
  ['Dead-link gate',               'node scripts/dead-link-check.mjs'],
  // Two nav gates, deliberately: the plain one is a CONTENT gate (a new page no
  // nav reaches) and is hard in every context; --baseline-check is the
  // derived-artifact freshness gate (advisory on PR, repaired on main). Folding
  // them into one command let PR #1309 ship an unlinked page green.
  ['Nav reachability — new islands (NAV-ISLAND-1)', 'node scripts/check-nav-reachability.mjs'],
  ['Nav-island baseline fresh (derived)', 'node scripts/check-nav-reachability.mjs --baseline-check'],
  ['Branch-aware PENDING-ASSEMBLE nav proof (NAV-ISLAND-PENDING-ASSEMBLE-1)', 'node scripts/check-nav-reachability.test.mjs'],
  ['Count-drift gate',             'node scripts/verify-counts.mjs --check'],
  // DEBT-LEDGER-1: fv-explainer.html's generated ratchet-baseline ledger (a
  // SEPARATE region from the count sentinels the gate above covers — see
  // derived-artifacts.mjs COVERED id 'debt-ledger'). ADVISORY_ON_PR/blocking-
  // on-main via the generic string-match categorisation, same as every other
  // shared-derived-artifact gate below.
  ['Debt ledger freshness (DEBT-LEDGER-1)', 'node scripts/gen-debt-ledger.mjs --check'],
  ['MCP protocol-version drift', 'node scripts/verify-mcp-protocol-version.mjs'],
  ['Deadline-wall freshness (SI-DEADLINE-FRESH-1)', 'node scripts/check-deadline-freshness.mjs'],
  ['Bank-fact freshness (REVERIFY-BANK-1)', 'node scripts/check-bank-fact-freshness.mjs'],
  ['Tool-number uniqueness',       'node scripts/check-tool-number-unique.mjs'],
  ['Tool-node pairing registry',   'node scripts/check-tool-node-pairings.mjs'],
  ['Topic cross-link registry (TOOLS-GRAPH-BRIDGE-1)', 'node scripts/check-topic-links.mjs'],
  ['Topic cross-link block freshness (TOOLS-GRAPH-BRIDGE-1)', 'node scripts/apply-topic-links.mjs --check'],
  ['Shipped-prose (no build jargon)', 'node scripts/check-shipped-prose.mjs'],
  ['Copy hallmarks (§1.4)',           'node scripts/check-copy-hallmarks.mjs'],
  // STALE-PHASING-NOTE-SWEEP-1 (2026-08-23). The documentation twin of the silent-green gate: a comment
  // that states a temporary condition and names its own exit ("only 5 of ~79 kernels ship fixtures
  // today ... Flip to --strict once every kernel has a fixture") is read as permanent fact forever,
  // because nobody re-reads a comment to check whether it expired. That one kept a coverage gate
  // lenient long after its stated reason had evaporated (629 of 629 by the time anyone looked —
  // KERNEL-CONTRACT-STRICT-1, PR #1493). This gate does not forbid phasing; it requires the note to
  // carry a DATE or a COMMAND so the next reader can re-evaluate instead of inheriting. Ratchet
  // baseline, hard-failing loader, counts only go down.
  ['Phasing-note ratchet (STALE-PHASING-NOTE-SWEEP-1)', 'node scripts/check-phasing-notes.mjs'],
  // Runs beside the gate, never after a failure would hide it. Layer 3 pins nine verbatim
  // legitimate uses of the same vocabulary ("currently throws later", "once every step above has
  // succeeded", "pending" as domain vocabulary) so a future loosening of the patterns reds HERE
  // instead of quietly turning the lint into noise that gets baselined away. Layer 4 is the row's
  // own known-answer check against the real kernel-contract comment. Run
  // `node scripts/check-phasing-notes.test.mjs` to see the whole layer list.
  ['Phasing-note gate controls (RED + GREEN + false-positive + known-answer)', 'node scripts/check-phasing-notes.test.mjs'],
  ['SSOT no dead npm commands (CONTRACT-DEADCMD-FIX-1)', 'node scripts/check-ssot-no-npm.mjs'],
  ['Credits registry coverage (vendored-code license gate)', 'node scripts/check-credits-coverage.mjs repo'],
  ['Credits page freshness (generated from registry)', 'node scripts/gen-credits.mjs repo --check'],
  ['MANIFEST name parity',         'node scripts/check-manifest-parity.mjs'],
  ['Manifest schema (SSOT-SCHEMA-1)', 'node scripts/check-manifest-schema.mjs'],
  ['Node-manifest generator dry-run (MFSTGEN-1)', 'node scripts/generate-node-manifest.mjs --all --check'],
  ['Evidence-profile manifest (EF-2)', 'node scripts/validate-evidence-profiles.mjs'],
  ['Chain domain taxonomy',        'node scripts/check-chain-domain.mjs'],
  // TOUCHTAX-DIFFSCOPE-1 (J19 §3.3): the shared line-level diff-scoping helper — one module,
  // wired into check-clause-digest.mjs, KERNEL-CITATION-CLASS-1 and jsdoc-checkjs alike (see
  // scripts/diff-scope.mjs's own header). Proven here once so the three consumers below don't
  // each need their own copy of the mutation-provable primitive proof.
  ['Diff-scope helper fixture proof (TOUCHTAX-DIFFSCOPE-1)', 'node scripts/diff-scope.test.mjs'],
  ['Cited clause digest (CLAUSE-DIGEST-GATE-1, SPEC.md §30)', 'node scripts/check-clause-digest.mjs'],
  ['Cited clause digest fixture proof', 'node scripts/check-clause-digest.test.mjs'],
  ['Kernel citation comments fixture proof (KERNEL-CITATION-CLASS-1, TOUCHTAX-DIFFSCOPE-1)', 'node chaingraph/kernels/lint-kernel-citation-comments.test.mjs'],
  ['Branch inventory reachability (AUTHORING-STANDARD §1)', 'node scripts/check-branch-inventory.mjs'],
  ['Branch inventory fixture proof (SO #40b pairing)', 'node scripts/check-branch-inventory.test.mjs'],
  ['Flag-mirror doctrine (AUTHORING-STANDARD §2)', 'node scripts/check-flag-mirror.mjs'],
  ['Flag-mirror doctrine fixture proof (SO #40b pairing)', 'node scripts/check-flag-mirror.test.mjs'],
  ['Chain composer-url existence (CHAINURL-GATE-1)', 'node scripts/check-chain-composer-urls.mjs'],
  ['Chain handoff-register regression (CHAINNARRATIVE-CLARIFY-1)', 'node scripts/check-chain-handoff-register.mjs'],
  // GENERATOR-STATUS-FILTER-1: a chain step that resolves to a NON-LIVE node is a
  // LIVE INTEROP DEFECT — find_chain advertises the departed entry tool as callable
  // while the worker registers node tools live-only, so an agent following the
  // estate's own recipe gets -32602 Tool not found. Nothing checked this before:
  // a status flip never touches graph/chains/*.json (assembler blind), validate-chains
  // only checks that a step RESOLVES, and L1 is advisory-and-always-exits-0.
  // HARD here, and therefore hard in scripts-verify / required, which runs this whole
  // suite (SO #54 — naming the context rather than assuming "advisory locally").
  ['Chain step-status (GENERATOR-STATUS-FILTER-1)', 'node scripts/check-chain-step-status.mjs'],
  ['Chain step-status controls (RED+GREEN)', 'node scripts/check-chain-step-status.test.mjs'],
  ['Node status lens controls (GENERATOR-STATUS-FILTER-1)', 'node scripts/_node-status.test.mjs'],
  ['Hub freshness (chains↔hub)',   'node scripts/gen-chain-index.mjs --check'],
  ['OCG conformance roster self-claim (OCG-CONFROSTER-BUILD-1)', 'node scripts/gen-ocg-conformance-roster.mjs --check'],
  ['OCG integrator profile freshness (OCG-INTEGRATOR-PROFILE-1)', 'node scripts/gen-integrator-profile.mjs --check'],
  ['Chain-builder catalog freshness (CHAINBUILDER-CATALOG-GEN-1)', 'node scripts/gen-chainbuilder-catalog.mjs --check'],
  ['Hub node-card coverage (HUB-GEN-1)', 'node scripts/gen-chaingraph-hub.mjs --check'],
  ['Guides index coverage (GUIDES-INDEX-GEN-1)', 'node scripts/gen-guides-index.mjs --check'],
  ['llms-full.txt freshness (§M2.3)', 'node scripts/gen-llms-full.mjs --check'],
  ['llms.txt estate map freshness', 'node scripts/gen-estate-map.mjs --check'],
  ['start.html search index freshness', 'node scripts/gen-start-index.mjs --check'],
  ['sitemap.xml freshness (DISCOVER-1)', 'node scripts/regen-sitemap.mjs --check'],
  ['sitemap.html freshness (SITEMAP-1)', 'node scripts/gen-sitemap-html.mjs --check'],
  // REGISTRY-LINEAGE-TILES-BUILD-1 hit a persistent HTTP 429 from seasalp.glasklar.is
  // (2026-08-18, unrecognized-domain shared bucket — see SIGSUM-BUDGET-COUNTER-1) and
  // checked off BLOCKED with nothing published. REGISTRY-LINEAGE-RETRY-1 (2026-08-20)
  // wired the domain-bound Sigsum submit token into the register-sigsum.mjs invocation,
  // fixed a WORKSPACE_ROOT bug that broke the research/ key paths from a worktree, added
  // a skip-if-unchanged guard, and re-ran successfully (HTTP 202, leaf_index 61275).
  // registry/lineage/** is NOT registered in scripts/derived-artifacts.mjs — see EXCLUDED
  // there: the C2SP tlog-tiles layout writes a new filename on every record append (old
  // partial tiles are left in place by design), which is incompatible with that file's
  // fixed literal `artifacts` list and the regen workflow's whole-tree anti-escape guard.
  // This --check gate (read-only recompute-and-verify) is the safe, standing freshness
  // check; publishing new records stays a manual/generated run, same as this one.
  ['F3 registry lineage log freshness (REGISTRY-LINEAGE-RETRY-1)', 'node scripts/gen-registry-lineage.mjs --check'],
  // REGISTRY-ERRATA-TILES-BUILD-1: wired here (satisfies check-generator-coverage.mjs's
  // hard "every --check generator must be invoked by preflight.mjs" rule) but the row
  // itself checked off BLOCKED — the F1 errata log's Sigsum anchoring step (mandatory per
  // BUILD-SPEC §2.1) hit the SAME persistent HTTP 429 from seasalp.glasklar.is that
  // blocked REGISTRY-LINEAGE-TILES-BUILD-1 on 2026-08-18, so NOTHING was ever written to
  // registry/errata/ (§2.1: publish nothing if that step did not complete).
  // REGISTRY-ERRATA-RETRY-1 (2026-08-21) re-ran the generator once the domain-bound
  // Sigsum submit token + SIGSUM-BUDGET-COUNTER-1 landed. See derived-artifacts.mjs
  // registration status alongside this gate for whether output now exists on disk.
  ['F1 registry errata log freshness (REGISTRY-ERRATA-RETRY-1)', 'node scripts/gen-registry-errata.mjs --check'],
  ['EUC register entries freshness (EUC-SITE-1)', 'node scripts/gen-euc-register.mjs --check'],
  // GENERATOR-STATUS-FILTER-1: the write path now PRUNES the stale entries it owns,
  // so the drift the gate above reports is finally repairable by main's writer —
  // the premise scripts/check-regen-repairable.mjs tests. Six prune controls
  // (real event / idempotent / CAP RED / confirm-prune / NOT-MINE / unchanged)
  // need a runner or they are a control that never fires.
  ['EUC register prune controls (GENERATOR-STATUS-FILTER-1)', 'node scripts/gen-euc-register.test.mjs'],
  ['EUC register page freshness (EUC-SITE-1)', 'node scripts/gen-euc-register-page.mjs --check'],
  ['Clause edge report freshness (CLAUSE-EDGE-TYPES-1)', 'node scripts/gen-clause-edge-report.mjs --check'],
  ['Clause edge report page freshness (CLAUSE-EDGE-TYPES-1)', 'node scripts/gen-clause-edge-report-page.mjs --check'],
  ['Agentic payments map freshness (AGENTIC-PAY-COOKBOOK-EXPLAINER-1)', 'node scripts/gen-agentic-payments-map.mjs --check'],
  ['OKF bundle freshness (chaingraph/okf)', 'node chaingraph/generate-okf.mjs --check'],
  ['Kernel VM page freshness',      'node chaingraph/vm/scripts/gen-kernel-vm-html.mjs --check'],
  ['Kernel VM widget freshness',    'node chaingraph/vm/scripts/gen-kernel-vm-widget.mjs --check'],
  ['Kernel VM explainer freshness', 'node chaingraph/vm/scripts/gen-kernel-vm-explainer.mjs --check'],
  ['OpenAPI freshness',             'node scripts/gen-openapi.mjs --check'],
  ['SSOT schema-validate',         'node chaingraph/standard/schema-validate.mjs'],
  ['SSOT version-consistency',     'node chaingraph/standard/spec-version-consistency.mjs'],
  ['SSOT gate-coverage',           'node chaingraph/standard/spec-gate-coverage.mjs'],
  ['SSOT catalog-parity (no orphans)', 'node scripts/check-catalog-parity.mjs'],
  ['SSOT spec-page parity',        'node chaingraph/standard/spec-page-parity.mjs'],
  ['SSOT spec-page subsections',   'node chaingraph/standard/spec-page-subsection-parity.mjs'],
  ['verify_repo (PII/sitemap/AP2)', changedRef ? `python scripts/verify_repo.py --changed ${changedRef}` : 'python scripts/verify_repo.py'],
  ['AP2 bulk contract-gap ratchet (AP2-DEBT-BASELINE-1)', 'node scripts/check-ap2-contract.mjs'],
  ['AP2 contract-gap gate controls (SO #40b pairing)', 'node scripts/check-ap2-contract.test.mjs'],
  ['§16 proof surface (chains)',   'node scripts/verify-proof-surface.mjs --chains-only'],
  ['§16 proof binding (unit)',     'node chaingraph/kernels/proof-binding.test.mjs'],
  ['§PPH-1 policy_parameters_hash', 'node chaingraph/kernels/policy-params-hash.test.mjs'],
  ['ocg-clause-binding@1 profile',  'node chaingraph/kernels/clause-binding.test.mjs'],
  ['§27 human-accountability records', 'node chaingraph/kernels/validate-ha-records.test.mjs'],
  ['§27.11 evidence verification',  'node chaingraph/kernels/hagate-evidence-verification.test.mjs'],
  ['Checklist/SOP runner (CHECKRUN-1)', 'node chaingraph/kernels/checklist-selftest.test.mjs'],
  ['§17 kernel identity (unit)',   'node chaingraph/kernels/kernel-identity.test.mjs'],
  ['§17 kernel-identity coverage', 'node chaingraph/kernels/gen-kernel-identity.mjs --check'],
  ['§17 kernel-identity coverage (shard, KERNELID-GATE-1)', 'node chaingraph/kernels/gen-kernel-identity.mjs --check --shard'],
  ['Property-testing floor',       changedRef ? `node scripts/run-proptests.mjs --base ${changedRef}` : 'node scripts/run-proptests.mjs'],
  // MUTATION-TIERED-ROLLOUT-1: pure classifier self-test, always runs (milliseconds, no Stryker
  // invocation) — proves chaingraph/kernels/mutation-tier-split.mjs still correctly separates
  // money-math (compute() + its module-scope helpers) from peripheral (buildArtifact()/meta)
  // BEFORE the mutation gate below trusts it to score anything.
  ['Mutation tier classifier self-test (MUTATION-TIERED-ROLLOUT-1)', 'node chaingraph/kernels/mutation-tier-split.test.mjs'],
  // MUTATION-TIERED-ROLLOUT-1: PR-incremental mutation gate, generalized from FV-STRYKER-PILOT-1
  // (board/done/FV-STRYKER-PILOT-1.md). Scoped to TOUCHED_KERNEL_IDS — the SAME touched-kernel-id
  // set the per-kernel `Kernel preflight (${id})` gates above already use — so a push touching
  // zero kernels costs nothing, and a push touching one kernel pays only that kernel's mutation
  // run (seconds to low minutes; art-508's 1,154-mutant floor was the pilot's slowest at ~4min).
  // The full-estate scan (`--all`) is deliberately NOT run here — it runs on its own nightly
  // schedule (.github/workflows/mutation-full-scheduled.yml) per the row's "PR-side incremental
  // gate only; full runs go to a scheduled workflow" instruction (SO #40).
  ...(TOUCHED_KERNEL_IDS.length
    ? [['Mutation tier floor (MUTATION-TIERED-ROLLOUT-1, touched kernels)',
        `node scripts/run-mutation-tier.mjs --kernel ${TOUCHED_KERNEL_IDS.join(' ')}`]]
    : [['Mutation tier floor (MUTATION-TIERED-ROLLOUT-1: no kernel/floor file touched, skipped)', 'node -e "1"',
        { notRun: 'this push touches no chaingraph/kernels/*.kernel.mjs or __proptests__/*.proptest.mjs, so the incremental mutation gate had nothing to examine' }]]),
  // ART27-HARNESS-INREPO-1: art-27's FV pilot record cites a full 3^12=531,441-state exhaustive
  // enumeration; this re-runs it in-repo every push (~3.4s measured — cheap enough for the normal
  // cadence, no scheduled-workflow home needed). Independent oracle, not run-proptests.mjs's floor
  // (see the file's own header for why it is deliberately not a *.proptest.mjs).
  ['art-27 exhaustive enumeration (ART27-HARNESS-INREPO-1)',
    'node chaingraph/kernels/__proptests__/art-27-agentic-readiness-diagnostic.exhaustive.mjs'],
  // RATCHET-BASELINE-LOADER-1 (gate-integrity F-11). Runs BEFORE the three ratchet gates it protects:
  // if a baseline file has been deleted, corrupted, key-stripped or given a non-finite ceiling, this
  // names the state directly instead of a gate downstream printing a green line over a ratchet that has
  // silently stopped existing. Layer 3 of the test is the anti-drift control — it reds if any of the
  // three call sites reintroduces a `?? Infinity` ceiling or a warn-only existsSync branch.
  ['Ratchet baseline loader controls (RED x4 + conversion)', 'node scripts/ratchet-baseline.test.mjs'],
  // DENOMINATOR-SENTINEL-1 (gate-integrity F-01…F-06, F-08). Sibling control to the loader above: that
  // one asks "does this ratchet still have a valid CEILING?", this one asks "did that gate actually
  // examine anything?". Six gates used to print a green line over an empty scope — 0 floors, 0 emitters,
  // 0 ledger entries, an absent chaingraph.json, 0 vectors — and "0 of 0 passed" is indistinguishable
  // from full coverage in a CI log. Layer 3 of this test is the anti-drift control: it reds if any of the
  // six reintroduces its silent default, OR if a denominator assert migrates out of a gate and into THIS
  // file, which is the wrapper shape the row bans.
  ['Denominator sentinel controls (RED x6 + boundary + not-a-wrapper)', 'node scripts/denominator-sentinel.test.mjs'],
  // GIT-ENV-LEAK-SWEEP-1. Third sibling of the two controls above, and the one that answers "was
  // this gate even looking at the right REPOSITORY?". Git exports GIT_DIR/GIT_WORK_TREE to every
  // hook it runs and they beat `cwd`, so a gate that shells to git from inside .githooks/pre-push
  // can return a well-formed verdict about the OUTER repo. Three modules learned that
  // independently and fixed it privately (DENOMINATOR-SENTINEL-1, SHARD-HARNESS-ENV-LEAK-1,
  // check-clause-digest.mjs) and nothing made it general — by the sweep the estate held six copies
  // of the scrub and 33 unprotected spawn sites. These two entries keep a seventh copy, and any
  // new unhelpered spawn, from landing. NOTE this pair must run under the HOOK to be meaningful,
  // which is exactly what preflight gives it — CI alone would never have caught the original.
  ['git-env scrub coverage (GIT-ENV-LEAK-SWEEP-1)', 'node scripts/check-git-env-scrub.mjs'],
  ['git-env scrub controls (RED x6 + wrong-tree contrast)', 'node scripts/check-git-env-scrub.test.mjs'],
  ['FV floor coverage ratchet (FV-COVERAGE-GATE-1)', 'node scripts/check-fv-floor-coverage.mjs'],
  ['FV floor coverage fixture proof', 'node scripts/check-fv-floor-coverage.test.mjs'],
  // FV-FLOOR-DIGEST-GATE-1: enforces the executed-digest authoring rule (FV-PBT-FLOOR-BUILD-SPEC.md §4,
  // amended by PR #1176) on ONLY the floor files THIS push touches (TOUCHED_FLOOR_FILES above) — never the
  // full floor estate, which would false-fail on legitimate later staleness. No-ops when nothing touched.
  ['FV floor digest authoring — touched files only (FV-FLOOR-DIGEST-GATE-1)',
    TOUCHED_FLOOR_FILES.length
      ? `node scripts/check-fv-floor-coverage.mjs --verify-authoring ${TOUCHED_FLOOR_FILES.map((f) => `"${f}"`).join(' ')}`
      : 'node -e "1"',
    TOUCHED_FLOOR_FILES.length
      ? null
      : { notRun: 'this push touches no __proptests__ floor file, so the authoring check had nothing to examine' }],
  ['§18 compute-integrity (unit)', 'node chaingraph/kernels/compute-proof.test.mjs'],
  // ADVISORY-ON-PR / HARD-ON-MAIN since PROVE-COVERAGE-GATE-SPLIT-1 (2026-08-22) — the split lives INSIDE
  // the gate (isMainContext() + disposition(), mirroring check-kernel-coverage.mjs), not in the
  // ADVISORY_ON_PR categorisation below: chaingraph.json's single-writer status is a property of the
  // artifact, so the same downgrade has to hold in preflight AND in both CI workflows that invoke it.
  ['§18 compute-proof coverage',   'node scripts/check-compute-proof-coverage.mjs'],
  ['§18 coverage split controls (RED/GREEN-on-PR/HARD-on-main)', 'node scripts/check-compute-proof-coverage.test.mjs'],
  ['§18 digest-freshness ratchet (S18-DIGEST-GATE-1)', 'node scripts/check-s18-digest-freshness.mjs'],
  ['§18 digest-freshness fixture proof', 'node scripts/check-s18-digest-freshness.test.mjs'],
  // PAGE-KERNEL-DIGEST-SENTINEL-1: the OTHER end of the same digest. S18-DIGEST-GATE-1 compares a
  // zkVM RECEIPT against the deployed kernel; this compares the PUBLIC PAGE's inline compute() copy
  // against it. Both call the same canonical sourceDigest() from _buildid.mjs. The page axis had no
  // gate at all until now: art-231 shipped a corrected kernel while its page kept serving the old
  // proxy JS, and nothing in the estate could see it. Ratchet, not a switch: 0 of 595 pages carried
  // a sentinel on adoption, so scripts/page-kernel-digest-baseline.json shields the legacy set,
  // shields ABSENCE only (a wrong sentinel on a baselined page still fails), and only ever shrinks.
  ['Page-kernel digest sentinel ratchet (PAGE-KERNEL-DIGEST-SENTINEL-1)', 'node scripts/check-page-kernel-digest.mjs'],
  ['Page-kernel digest fixture proof (SO #40b pairing)', 'node scripts/check-page-kernel-digest.test.mjs'],
  // §18 RECOMPUTE-EQUALITY (SO #34, ASYNC-VACUOUS-GATE-1). Re-executes every proven node's kernel in the
  // QuickJS sandbox and requires the receipt's journal.output to reproduce. ~8s over the full estate.
  ['§18 recompute-equality (SO #34)', 'node scripts/check-recompute-equality.mjs'],
  ['§18 recompute-equality controls (canary + mutation)', 'node scripts/check-recompute-equality.test.mjs'],
  ['Proof-badge freshness',        'node scripts/check-proof-badge.mjs'],
  ['Kernel as-of staleness ratchet (ASOF-GATE-1)', 'node scripts/check-kernel-asof-staleness.mjs'],
  ['Kernel as-of staleness fixture proof', 'node scripts/check-kernel-asof-staleness.test.mjs'],
  // Deliberately NOT inside the HELM_SCOPE_TOUCHED block below. That scoping exists
  // because the version-drift gate asserts against state the SEPARATE helm repo's
  // release job sets, so it goes stale on a cadence no site push controls. This gate
  // has no such dependency: it compares the vendored markdown against its own pinned
  // digest and the page against that markdown, both in this repo, both deterministic.
  // Scoping it would also silently ungate it, since isHelmPath() above does not match
  // helm-technical-design.html.
  ['Helm technical design page parity', 'node scripts/check-helm-techdoc-parity.mjs'],
  ['Helm technical design parity fixture proof', 'node scripts/check-helm-techdoc-parity.test.mjs'],
  // HELMGATE-DECOUPLE-1: scoped — only run when this push touches a helm-relevant
  // path (see helmPathsTouched() above). Undeterminable fails open (gates run).
  // HELMGATE-DECOUPLE-2: guide-freshness (the byte-identical-walkthrough check)
  // moved OFF this blocking path entirely — it now runs report-only on a schedule
  // (.github/workflows/helm-guide-freshness-schedule.yml), same shape as the
  // worker's Vendor Freshness. version-drift stays here unchanged: it's
  // machine-satisfiable and has never blocked on a human duty.
  ...(HELM_SCOPE_TOUCHED ? [
    ['Helm release/version drift (HELM-RELEASE-DRIFT-GATES-1)', 'node scripts/check-helm-version-drift.mjs'],
    ['Helm release/version drift fixture proof', 'node scripts/check-helm-version-drift.test.mjs'],
  ] : [
    ['Helm gates (HELMGATE-DECOUPLE-1: no helm-path changes, skipped)', 'node -e "1"',
      { notRun: 'HELMGATE-DECOUPLE-1 scoping — this push touches no helm path, so the drift gates were not executed' }],
  ]),
  ['§20 anchor binding (unit)',    'node chaingraph/kernels/anchor-binding.test.mjs'],
  ['§13.12 SD-JWT round-trip',     'node chaingraph/exporters/sd-export-roundtrip.test.mjs'],
  ['Chain runners up-to-date',    'node scripts/gen-chain-runners.mjs --check'],
  ['Workbench up-to-date',        'node scripts/gen-workbench.mjs --check'],
  ['Canvas up-to-date',           'node scripts/gen-canvas.mjs --check'],
  ['Wayfinder freshness',         'node scripts/gen-wayfinder.mjs --check'],
  ['Node-page chrome (nav/footer)', 'node scripts/check-node-page-chrome.mjs'],
  // HUB-CHROME-GATE-1: same shape as the node-page chrome gate above, for the
  // OTHER ungated chrome surface the 2026-08-21 0xAlpha audit found (Findings
  // A/B). Logo check is baseline-ratcheted (45 known text-only hubs,
  // HUB-LOGO-NORMALIZE-1's job to fix); footer check is zero-tolerance —
  // see scripts/check-hub-chrome.mjs's header for why "canonical footer" is
  // a content invariant here, not one shared template.
  ['Hub-guide chrome (logo/footer, HUB-CHROME-GATE-1)', 'node scripts/check-hub-chrome.mjs'],
  ['Hub-guide chrome self-test (GATE-SELFTEST-META-1 pairing)', 'node scripts/check-hub-chrome.test.mjs'],
  ['FV pilot badge freshness (FV-BADGE-1)', 'node scripts/inject-fv-pilot-badges.mjs --check'],
  ['FV pilot evidence-vector shape (FV-EVIDENCE-VECTOR-1)', 'node scripts/check-fv-pilot-badge.mjs --check'],
  ['Root-page chrome freshness (INDEX-SIMPLIFY-1)', 'node scripts/gen-root-chrome.mjs --check'],
  ['No copyright-year splash (INDEX-SIMPLIFY-1)', 'node scripts/check-no-copyright-year.mjs'],
  ['CSP consistency (FOOTER-1)',   'node scripts/check-csp-consistency.mjs'],
  ['Internal-lang leak (INTERNAL-LANG-LEAK-1)', 'node scripts/check-internal-lang-leak.mjs'],
  ['Verify-path no-egress (AV-NOEGRESS-1)', 'node scripts/check-verify-no-egress.mjs'],
  ['Site static egress scan (EGRESS-SITE-1)', 'node scripts/check-site-egress.mjs'],
  ['Ledger hermetic',              'node scripts/check-ledger-hermetic.mjs'],
  ['Playground hermetic (A8)',     'node scripts/check-playground-hermetic.mjs'],
  ['Ledger codec round-trip',      'node scripts/codec-roundtrip.test.mjs'],
  ['Ledger gate-replay tamper (shipped source)', 'node scripts/gate-replay-tamper.test.mjs'],
  ['Ledger escalation-closure tamper (shipped source)', 'node scripts/escalation-closure-tamper.test.mjs'],
  ['OCG verify.html proven-to-reject (AV-REJECT-FIX-1)', 'node scripts/ocg-verify-hash-tamper.test.mjs'],
  ['tools/568 receipt verifier proven-to-reject (AV-REJECT-FIX-1, shipped source)', 'node scripts/ocg-receipt-verifier-568-tamper.test.mjs'],
  // TAMPER-GATE-SHIPPED-SOURCE-1: retitled off "proven-to-reject". That label claimed a
  // witness-signature rejection this gate never performs — it exercises the shipped
  // checkpoint-note parser and the root/origin cross-check only; the Ed25519 / ML-DSA-44
  // legs of art-424's computeVerifier are NOT run here. Restore a "proven-to-reject"
  // label only when a gate actually exercises signature verification.
  ['art-424 checkpoint root/origin tamper (signature legs NOT exercised) (AV-REJECT-FIX-1)', 'node scripts/witness-checkpoint-424-tamper.test.mjs'],
  ['Generator coverage (meta-gate)', 'node scripts/check-generator-coverage.mjs'],
  // GATE-SELFTEST-META-1 (0xAlpha 2026-08-21 audit, Tier B Rec 1 / SO #40b): natural
  // home alongside the generator-coverage meta-gate above — same shape, different
  // question ("does every NEW blocking check-X.mjs gate carry a paired red-proof
  // self-test" vs "does every --check generator get invoked").
  ['Gate self-test pairing (meta-gate, GATE-SELFTEST-META-1)', 'node scripts/check-gate-selftest-pairing.mjs'],
  ['Gate self-test pairing fixture proof', 'node scripts/check-gate-selftest-pairing.test.mjs'],
  // ADVISORY-CRASH-DISTINCT-1: preflight's OWN reporting control, in the meta-gate
  // cluster because that is what it is — a check on this repo's instruments, not on
  // its content. `--self-test` exits before any gate, git diff or estate scan runs,
  // so this costs ~1s and cannot recurse. It proves, with real subprocesses and the
  // real classifier, that could-not-run and ran-and-warned stay distinguishable and
  // that the result accounting still detects an unrecorded gate. Without it the
  // classifier is exactly the kind of checker that rots green.
  ['Preflight advisory-state controls (ADVISORY-CRASH-DISTINCT-1)', 'node scripts/preflight.mjs --self-test'],
  ['Standards vectors (IBAN/LEI/BIC/UETR/ABA)', 'node scripts/standards-vectors.test.mjs'],
  ['Authority contradiction gate (CB4-CONTRADICTION-GATE-1)', 'node scripts/check-authority-contradiction.mjs'],
  ['Authority contradiction gate fixture proof', 'node scripts/check-authority-contradiction.test.mjs'],
  ['Amendment detection gate (CB7-AMENDMENT-DETECT-1)', 'node scripts/check-amendment-detection.mjs'],
  ['Amendment detection gate fixture proof', 'node scripts/check-amendment-detection.test.mjs'],
  ['JSON-LD structural validity (JSONLD-1)', 'node scripts/check-jsonld.mjs'],
  ['Template integrity (advisory, TPL-GATE-1)', 'node scripts/check-template-integrity.mjs'],
  ['CSV-injection sanitization (WB-5)', 'node scripts/check-csv-injection.mjs'],
  ['Workbook unit fixtures (WB-1)',     'node chaingraph/workbook/workbook.test.mjs'],
  ['Workbook determinism fixture (WB-5)', 'node chaingraph/workbook/check-determinism-fixture.mjs'],
  ['Round-trip comparator unit fixtures (XLR-2)', 'node chaingraph/workbook/roundtrip-verify.test.mjs'],
  ['Round-trip golden-fixture determinism (XLR-5)', 'node chaingraph/workbook/check-roundtrip-determinism.mjs'],
  ['Proposals schema/slug/copy (AGENTPR-1)', 'node scripts/verify-proposals.mjs'],
  // Node leg of cross-engine parity: catches a kernel edit that makes the Node
  // parity-manifest generation itself crash/error. The cross-engine byte diff
  // (Bun + QuickJS legs) genuinely needs those runtimes and stays CI-only.
  ['Engine-parity node-leg (crash guard)', 'node scripts/check-engine-parity.mjs'],
  // Every workflow file must PARSE. An invalid one makes GitHub emit a zero-job failure run on
  // every push to every branch (its branch filter is never evaluated) — measured 2026-08-16,
  // derived-artifacts-regen.yml, eleven red runs in three hours. Parity below reads gate names
  // out of these files, so it silently sees nothing when the YAML is broken.
  ['Workflow YAML parses (on + jobs)', 'python scripts/check-workflow-yaml.py'],
  // JSON-parse + no-read-only-fields check for .github/rulesets/*.json (RULESET-AS-CODE-1).
  // Purely local — the "does it match live" half needs an App token and stays CI-only
  // (ruleset-apply.yml / ruleset-drift-gate.yml).
  ['Ruleset files parse (no read-only API fields)', 'node scripts/check-ruleset-json.mjs'],
  // Every artifact the main-side regen declares must exist on disk — the workflow stages by
  // that exact list and a phantom entry aborts `git add` (measured 2026-08-16: two phantom
  // catalog paths zeroed the stage and misreported every real artifact as escaped).
  ['Derived-artifact SSOT paths exist', 'node scripts/derived-artifacts.mjs --check-paths'],
  // NODE-FANOUT-REGEN-CLOSE-1: every generator that reads the node graph AND
  // publishes a freshness gate must be CLASSIFIED in derived-artifacts.mjs —
  // COVERED (main regenerates it) or EXCLUDED (a decision with a measured
  // reason). Unclassified is the failure, because that is precisely the state
  // that redded main three times on 2026-08-21 and silently ejected every PR
  // from the merge queue each time. Hard in every context: this is a
  // declaration check on the repo's own wiring, not an artifact freshness gate,
  // so nothing about it is a branch's fault or a branch's to repair.
  ['Derived fan-out classification (NODE-FANOUT-REGEN-CLOSE-1)', 'node scripts/check-derived-fanout-coverage.mjs'],
  ['Derived fan-out classification control (mutation)', 'node scripts/check-derived-fanout-coverage.test.mjs'],
  // DERIVED-DECLARE-PARITY-1: statically parses what each COVERED regen
  // command actually writes and asserts it is a subset of the entry's
  // declared artifacts[] — the mechanical kill for the 2026-08-20 enrolment
  // incident (undeclared chaingraph.meta.json write → regen dead → count
  // drift → Land Verify/Deploy red → merge-queue lock, SO #47). Prevention,
  // not diagnosis: reds locally, before push.
  //
  // Complementary to the fan-out classification gate directly above, not a
  // duplicate of it: that one asks "is every node-sensitive generator
  // CLASSIFIED at all", this one asks "does a COVERED entry DECLARE everything
  // it actually writes". Both landed 2026-08-21 for the same incident family,
  // and each catches cases the other passes.
  ['Derived-artifact declare parity (DERIVED-DECLARE-PARITY-1)', 'node scripts/check-derived-declare-parity.mjs --check'],
  ['Derived-artifact declare parity self-test (SO #40b pairing)', 'node scripts/check-derived-declare-parity.test.mjs'],
  // DERIVED-SET-SELFTEST-1: the DYNAMIC complement to DERIVED-DECLARE-PARITY-1's
  // static analysis — actually RUNS every COVERED regen command in a scratch
  // worktree and watches the filesystem + `git status`, catching what static
  // source parsing structurally cannot see (a python generator, a write gated
  // behind logic the parser can't resolve, a write that only fails at runtime).
  // The fixture self-test (SO #40b pairing) is fast (synthetic git repos, no
  // real generator involved) and runs unconditionally; the live scan against
  // the REAL COVERED list is slow (2-3 minutes) and scoped to pushes that
  // touch derived-artifacts.mjs or a generator/gate script it names.
  ['Derived-set regen selftest fixture proof (SO #40b pairing)', 'node scripts/check-derived-regen-live.test.mjs'],
  ...(DERIVED_REGEN_LIVE_SCOPE_TOUCHED
    ? [['Derived-set live regen selftest (DERIVED-SET-SELFTEST-1)', 'node scripts/check-derived-regen-live.mjs --check']]
    : [['Derived-set live regen selftest (DERIVED-SET-SELFTEST-1: no derived-artifacts/generator path touched, skipped)', 'node -e "1"',
        { notRun: 'DERIVED-SET-SELFTEST-1 scoping — this push touches no scripts/derived-artifacts.mjs or generator/gate script it names, so the live regen self-test (which actually executes every regen command) was not run' }]]),
  // MERGEQUEUE-GATE-PARITY-1: the control for the merge-queue repairability probe
  // that runs at the end of this file. Fixture-driven (a scripted command table,
  // no git, no generators), so it is milliseconds and cannot be perturbed by the
  // estate's real freshness state. Its load-bearing case replays the exact
  // command behaviour measured on the PR #1477 fixture — a --check that detects
  // drift its own --write cannot repair — and requires the verdict to be
  // UNREPAIRABLE. A red here means the probe itself stopped working, which is
  // how the 15-hour red main happened in the first place.
  ['Merge-queue repairability probe control (mutation)', 'node scripts/check-regen-repairable.test.mjs'],
  // DEPLOY-REGEN-RACE-1: the control for scripts/check-deploy-superseded.mjs, the
  // classifier deploy-to-dreamhost.yml's `supersede` job runs on main. That script
  // is main-only by construction (there is no regen bot to race on a branch), so
  // it is CI_ONLY in check-workflow-gate-parity.mjs and THIS is where it gets its
  // pre-push coverage. Polarity is inverted from a normal gate: the outcome it can
  // grant is a STAND-DOWN, so the load-bearing case is that a genuinely stale
  // artifact the regen cannot repair yields superseded=FALSE — i.e. Deploy still
  // reds. A green here is what keeps this from being a disabled deploy gate. Its
  // last block also re-derives the gate set from the real workflow, so removing
  // those steps (or breaking the parse) goes red here rather than on main.
  ['Deploy supersede classifier control (mutation + live derivation)', 'node scripts/check-deploy-superseded.test.mjs'],
  // TWO AXES since WORKFLOW-GATE-PARITY-ASSERT-1 (2026-08-23): PRESENCE (does CI
  // run a node gate preflight doesn't?) and STATUS (is the same gate advisory at
  // one call site and blocking at another, in a context both can reach?). Variant
  // 4 of the family MERGEQUEUE-GATE-PARITY-1 proved: "is this gate blocking?" is
  // decided per call site, not as a property of the gate. Divergence is allowed —
  // it just has to be DECLARED, so a session reading a local ⚠ ADVISORY can find
  // out that a required CI context runs the same gate hard (SO #54).
  ['Workflow gate parity (no CI↔preflight drift)', 'node scripts/check-workflow-gate-parity.mjs'],
  // The CONTROL for the status axis (SO #40b / GATE-SELFTEST-META-1): a comparison
  // over two text extractions can quietly compare NOTHING and report "consistent",
  // which reads exactly like a clean repo. Every case is a mutation control; the
  // ABSENCE cases (stale declaration, argument drift, uncalled gate, unparseable
  // `on:` block, an unmodelled softener) are the ones this family is made of.
  ['Workflow gate parity controls (status axis, mutation)', 'node scripts/check-workflow-gate-parity.test.mjs'],
  // The CONTROL for the L1 chain edge-contract checker — not a check on the estate. In-memory
  // fixture chains (right kernels / wrong edge must fail, known-good must pass) plus mutation
  // controls that flip each fact and require the verdict to move. Hard here because a red
  // selftest means the tool itself is broken — same shape as the "FV floor coverage fixture
  // proof" entry above. The checker's own chain verdicts stay ADVISORY (block below).
  ['Chain L1 edge-contract selftest (CHAIN-FV-L1-1)', 'node scripts/check-chain-edge-contracts.selftest.mjs'],
  // The CONTROL for the L2 chain contract-composition checker (CHAIN-FV-L2-1) — same shape as the
  // L1 selftest above: in-memory fixtures (§5.1's re-expressed L1 cases + the four synthetic
  // controls) plus mutation controls that flip a bound/enum/unit/x-source digest and require the
  // verdict to move. Hard here because a red selftest means the tool itself is broken. The
  // checker's own chain verdicts stay ADVISORY-on-existing / HARD-on-new-changed (block below).
  ['Chain L2 contract-composition selftest (CHAIN-FV-L2-1)', 'node scripts/check-chain-l2-contracts.selftest.mjs'],
  // CHAIN-FV-L2-G-RESCOPE-3: the derived output-contract sidecars must stay in sync with the fixtures
  // they are derived from. --check re-derives and diffs; a red means a fixture changed without the
  // sidecar being regenerated (`node scripts/gen-output-schema.mjs`). Hard because a stale sidecar is
  // a stale witness domain the L2-G checker would silently trust.
  ['Output-contract sidecars in sync with fixtures (CHAIN-FV-L2-G-RESCOPE-3)', 'node scripts/gen-output-schema.mjs --check --quiet'],
];

// The one inline gate that lives below the loop rather than in GATES. Named once
// here so the totals can be derived from the real run list instead of a literal.
const MFSTSEC_LABEL = 'mfstSec presence (every tool)';
// PREFLIGHT-KEEPGOING-1: the run list is GATES plus that inline check. DERIVED at
// runtime — a gate added to GATES raises this by itself, and nothing anywhere
// hardcodes how many gates preflight runs.
const RUN_LIST_SIZE = GATES.length + 1;

// PREFLIGHT-KEEPGOING-1: an --expect-red id that matches no gate would waive
// nothing while reading as diligence, so it is a hard error before any gate runs.
if (EXPECT_RED.length) {
  const labels = [...GATES.map(([l]) => l), MFSTSEC_LABEL];
  const unmatched = EXPECT_RED.filter((id) => !labels.some((l) => l.toLowerCase().includes(id.toLowerCase())));
  if (unmatched.length) {
    console.error(`❌ --expect-red: no gate label matches ${unmatched.map((u) => `"${u}"`).join(', ')}.`);
    console.error('   Match is a case-insensitive SUBSTRING of the gate label (e.g. "CGSHARD-1").');
    console.error('   Fix the id or drop the flag — a declaration that waives nothing is worse than none.');
    process.exit(2);
  }
}

let failed = null;
const timings = []; // [label, ms]
// PREFLIGHT-KEEPGOING-1: per-gate outcome ledger — { label, state, ms, note }.
// state ∈ PASS | FAIL | EXPECTED-RED | DID-NOT-RUN. Written on every path, read
// ONLY by the --keep-going summary, so it cannot affect default behaviour.
const results = [];
let waivedCount = 0;
const advisoryFailures = []; // [label, cmd] — covered-artifact staleness on a PR
const coveredFailures = []; // [label, cmd] — covered-artifact staleness on MAIN (hard red, classified below)
const suiteStart = Date.now();

if (KEEP_GOING) {
  console.log('▶ preflight --keep-going: running EVERY gate and collecting every result.');
  console.log('  (the default no-flag run is unchanged and still stops at the first red)');
  if (EXPECT_RED.length) {
    console.log(`  --expect-red declared for THIS invocation only: ${EXPECT_RED.join(', ')}`);
  }
  console.log('');
}

for (const [label, cmd, meta] of GATES) {
  // A slot the runner itself replaced with a no-op (helm scoping, no touched floor
  // files) DID NOT RUN. Under --keep-going say exactly that; a no-op's exit 0 is
  // absence of a result, never a pass.
  if (KEEP_GOING && meta?.notRun) {
    console.log(`⊘ ${label} … DID NOT RUN`);
    results.push({ label, state: 'DID-NOT-RUN', ms: 0, note: meta.notRun });
    continue;
  }
  gateStart(label);
  const t0 = Date.now();
  try {
    execSync(cmd, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const ms = Date.now() - t0;
    timings.push([label, ms]);
    gatePass(`✓ (${ms}ms)`);
    const declared = KEEP_GOING ? expectedRedFor(label) : null;
    results.push({
      label,
      state: 'PASS',
      ms,
      note: declared ? `declared --expect-red ${declared} but PASSED — the declaration was unnecessary` : meta?.note,
    });
  } catch (e) {
    const ms = Date.now() - t0;
    timings.push([label, ms]);
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    // Shared derived artifact + PR context ⇒ warn and CONTINUE. Same output, no
    // early break, no hidden failure — main's regen owns this artifact now.
    //
    // ADVISORY-CRASH-DISTINCT-1: two changes, both reporting-only.
    //  (a) SPLIT the outcome. A gate whose checker RAN and found the artifact
    //      stale is a result and still reads `⚠ ADVISORY` (the CGSHARD-1 /
    //      REGISTRY-RESOLVE-STATIC-1 / EUC-SITE-1 / kernel-VM-explainer shape,
    //      measured). A gate whose checker COULD NOT RUN reported nothing at all
    //      and now reads `✗ UNAVAILABLE`.
    //  (b) RECORD a result on both paths. This `continue` used to leave the
    //      ledger short by one, which is exactly what produced the trailing
    //      `RESULT ACCOUNTING MISMATCH` — and made an otherwise clean
    //      --keep-going run exit 1 while every gate it ran was green.
    // ⛔ Neither path changes the exit code: advisory-on-PR stays advisory.
    if (!MAIN_CONTEXT && ADVISORY_ON_PR.has(cmd)) {
      const c = classifyExecFailure(e);
      if (c.ran) {
        gateFail(`⚠ (${ms}ms) ADVISORY`);
        console.log('\n' + out.trim() + '\n');
        advisoryFailures.push([label, cmd]);
        results.push({ label, state: 'ADVISORY', ms, note: meta?.note });
      } else {
        gateFail(`✗ (${ms}ms) UNAVAILABLE — ${c.reason}`);
        console.log('\n' + out.trim() + '\n');
        unavailableAdvisories.push({ label, reason: c.reason });
        results.push({ label, state: 'UNAVAILABLE', ms, note: `${c.reason} — this gate reported NOTHING; ⛔ absence of a result is not a pass (SO #34c)` });
      }
      continue;
    }
    // MERGEQUEUE-GATE-PARITY-1: same gate, MAIN context — nothing is downgraded
    // and this stays a hard red, but record it so the classifier below can say
    // WHICH KIND of red it is (regen lag vs permanent). Those two are
    // indistinguishable in the log today, and telling them apart by eye is
    // exactly what did not happen for 15 hours on 2026-08-22/23.
    if (MAIN_CONTEXT && ADVISORY_ON_PR.has(cmd)) coveredFailures.push([label, cmd]);
    const declared = KEEP_GOING ? expectedRedFor(label) : null;
    gateFail(declared ? `✗ (${ms}ms) [EXPECTED-RED via --expect-red ${declared}]` : `✗ (${ms}ms)`);
    console.log('\n' + out.trim() + '\n');
    results.push({
      label,
      state: declared ? 'EXPECTED-RED' : 'FAIL',
      ms,
      note: declared ? `red, waived for this invocation only by --expect-red ${declared}` : meta?.note,
    });
    if (failed === null) failed = label; // where a fail-fast run stops
    if (!KEEP_GOING) break;
  }
}

// mfstSec presence — every tool HTML must carry the manifest panel (CI hard gate).
// `!failed` keeps the default fail-fast path identical; `|| KEEP_GOING` is what
// makes the run-all mode actually run all.
if (!failed || KEEP_GOING) {
  gateStart('mfstSec presence (every tool)');
  const t0 = Date.now();
  const missing = readdirSync(resolve(REPO, 'tools'))
    .filter(f => f.endsWith('.html'))
    .filter(f => !readFileSync(resolve(REPO, 'tools', f), 'utf8').includes('mfstSec'));
  const ms = Date.now() - t0;
  timings.push(['mfstSec presence (every tool)', ms]);
  if (missing.length) {
    const declared = KEEP_GOING ? expectedRedFor(MFSTSEC_LABEL) : null;
    gateFail(declared ? `✗ (${ms}ms) [EXPECTED-RED via --expect-red ${declared}]` : `✗ (${ms}ms)`);
    console.log('\nTools missing the mfstSec manifest panel:\n  ' + missing.join('\n  ') + '\n');
    results.push({
      label: MFSTSEC_LABEL,
      state: declared ? 'EXPECTED-RED' : 'FAIL',
      ms,
      note: declared ? `red, waived for this invocation only by --expect-red ${declared}` : undefined,
    });
    if (failed === null) failed = 'mfstSec presence';
  } else {
    gatePass(`✓ (${ms}ms)`);
    results.push({ label: MFSTSEC_LABEL, state: 'PASS', ms });
  }
}

// ── MERGEQUEUE-GATE-PARITY-1: classify a MAIN-context freshness red ─────────
// Print-only. The gate already failed on its own merits and this NEVER softens
// that — check-regen-repairable.mjs --diagnose always exits 0 and its output is
// not consulted for the verdict. What it adds is the one distinction the log
// cannot make today: is this red REGEN LAG (the single writer is repairing it on
// this same push; expected, self-clearing) or PERMANENT (nothing will ever clear
// it; it needs a human PR)? Both printed identically before, and a permanent one
// sat unnoticed among transient ones for 15 hours.
if (MAIN_CONTEXT && coveredFailures.length) {
  const idsFor = new Map(COVERED.filter((c) => c.gate).map((c) => [c.gate, c.id]));
  const ids = [...new Set(coveredFailures.map(([, cmd]) => idsFor.get(cmd)).filter(Boolean))];
  if (ids.length) {
    console.log('');
    try {
      const o = execSync(`node scripts/check-regen-repairable.mjs --diagnose --ids ${ids.join(',')}`, {
        cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(o.toString().trim());
    } catch (e) {
      // Classification is a convenience, never a gate. If it cannot run, say so
      // plainly and move on — it must not add a way for preflight to fail, and it
      // must not add a way for preflight to pass either (it touches no verdict).
      console.log(`ℹ regen-repairability diagnosis unavailable: ${((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim().split('\n')[0]}`);
    }
  }
}

const totalMs = Date.now() - suiteStart;
console.log(`\nTOTAL ${(totalMs / 1000).toFixed(1)}s`);

if (totalMs > BUDGET_MS) {
  const slowest = [...timings].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`⚠️  BUDGET ADVISORY: preflight took ${(totalMs / 1000).toFixed(1)}s, over the ${(BUDGET_MS / 1000).toFixed(0)}s budget. Slowest 3 gates:`);
  for (const [label, ms] of slowest) console.log(`    ${ms}ms — ${label}`);
  console.log('    (advisory only — not a hard fail; wall-clock budgets are machine-dependent)');
}

// ── PREFLIGHT-KEEPGOING-1: run-all summary ──────────────────────────────────
// Only reached with --keep-going / --expect-red. The default path skips this
// entire block and falls straight through to the unchanged fail-fast exit below.
if (KEEP_GOING) {
  const of = (state) => results.filter((r) => r.state === state);
  const passed = of('PASS');
  const hardFails = of('FAIL');
  const waived = of('EXPECTED-RED');
  const didNotRun = of('DID-NOT-RUN');
  const advisory = of('ADVISORY');
  const unavailable = of('UNAVAILABLE');
  waivedCount = waived.length;
  const tally = tallyResults(results);

  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const rule = '─'.repeat(78);
  console.log(`\n${rule}`);
  console.log('KEEP-GOING SUMMARY — every gate reached, nothing masked by an earlier red');
  console.log(rule);
  for (const r of results) {
    console.log(`  ${pad(r.state, 13)}${String(r.ms).padStart(7)}ms  ${r.label}`);
    if (r.note) console.log(`                             ↳ ${r.note}`);
  }
  console.log(rule);
  console.log('TOTALS — derived from the gate list at runtime, never hardcoded');
  console.log(`  gates in the run list ...... ${RUN_LIST_SIZE}  (GATES array + the inline ${MFSTSEC_LABEL} check)`);
  console.log(`  results recorded ........... ${results.length}`);
  console.log(`  PASS ....................... ${passed.length}`);
  console.log(`  FAIL (unwaived) ............ ${hardFails.length}`);
  console.log(`  EXPECTED-RED (waived) ...... ${waived.length}${waived.length ? `   [declared this run: ${EXPECT_RED.join(', ')}]` : ''}`);
  console.log(`  ADVISORY (ran, warned) ..... ${advisory.length}   ⚠ the checker RAN — shared derived artifact stale on a PR (SO #35)`);
  console.log(`  UNAVAILABLE (could not run)  ${unavailable.length}   ⛔ its own category — the checker produced NO result (SO #34c)`);
  console.log(`  DID NOT RUN ................ ${didNotRun.length}   ⛔ its own category — never counted as a pass`);
  // Derived from RESULT_STATES, not from a hand-written sum: a state added to the
  // ledger without being wired in here lands in `uncategorised` and reds the
  // reconciliation below, instead of quietly shrinking `accounted`.
  const accounted = tally.accounted;
  console.log(`  accounted for .............. ${accounted}${tally.uncategorised ? `   ⛔ plus ${tally.uncategorised} result(s) in an UNRECOGNISED state` : ''}`);
  console.log(rule);

  if (failed) {
    const firstRed = results.findIndex((r) => r.state === 'FAIL' || r.state === 'EXPECTED-RED');
    console.log(`  A bare fail-fast run would have STOPPED at: ${results[firstRed].label}`);
    console.log(`  and would have reported nothing about the ${results.length - firstRed - 1} gate(s) after it.`);
    console.log(rule);
  }

  // FAIL CLOSED (SO #34c): a result count that does not reconcile with the run
  // list means gates went unrecorded, and an unrecorded gate is not a green one.
  if (results.length !== RUN_LIST_SIZE || accounted !== results.length) {
    console.error(`\n❌ preflight --keep-going: RESULT ACCOUNTING MISMATCH — ${RUN_LIST_SIZE} gate(s) in the run list, ${results.length} result(s) recorded, ${accounted} categorised.`);
    console.error('   Some gate produced no result, so this run proves nothing. Treat it as unverified.');
    process.exit(1);
  }

  if (hardFails.length) {
    console.error(`\n❌ preflight --keep-going FAILED: ${hardFails.length} unwaived gate(s) red (of ${RUN_LIST_SIZE} in the run list).`);
    for (const r of hardFails) console.error(`   ✗ ${r.label}`);
    console.error('   Fix these before pushing (each would have failed CI).');
    process.exit(1);
  }
}

// ── MERGEQUEUE-GATE-PARITY-1: was that advisory downgrade EARNED? ───────────
// The downgrade above (line ~864) rests on ONE premise: main's regen workflow
// repairs this artifact after merge. That premise was never tested, and PR #1477
// falsified it — gen-euc-register.mjs --check detects a STALE entry (a node that
// went non-live) but its write path only writes entries for live nodes and has
// no code path that deletes one. So the queue downgraded drift the main-side
// writer could not erase, `merge_group` reported success, and the `push: main`
// run on the IDENTICAL SHA reported failure eight minutes later. Five SHAs in
// one morning; main red for 15 hours (see check-regen-repairable.mjs's header
// for the measured evidence).
//
// This block tests the premise instead of assuming it, in a throwaway worktree
// off HEAD. Drift the regen erases stays advisory — unchanged behaviour. Drift
// it CANNOT erase blocks here, because it will red main.
//
// ⚠ NOT in GATES/RUN_LIST_SIZE on purpose: it is conditional on a result only
// known AFTER the gate loop (which gates were downgraded), so folding it into
// the run list would break --keep-going's fail-closed accounting reconciliation
// every time no gate was downgraded. It prints unconditionally instead — when it
// does not run, it says why, so it is never a silent hiding place (SO #34c).
const PROBE_LABEL = 'Advisory downgrade is regen-repairable (MERGEQUEUE-GATE-PARITY-1)';
let probeFailed = false;
if (!MAIN_CONTEXT && !advisoryFailures.length) {
  console.log(`\n▶ ${PROBE_LABEL} … not needed (no shared derived artifact was downgraded this run).`);
} else if (!MAIN_CONTEXT && failed) {
  console.log(`\n▶ ${PROBE_LABEL} … DID NOT RUN (an earlier gate is already red; fix that first). ⛔ Not a pass.`);
} else if (!failed && !MAIN_CONTEXT && advisoryFailures.length) {
  const idsFor = new Map(COVERED.filter((c) => c.gate).map((c) => [c.gate, c.id]));
  const ids = [...new Set(advisoryFailures.map(([, cmd]) => idsFor.get(cmd)).filter(Boolean))];
  if (!ids.length) {
    // Every advisory command is an advisoryGates() member, and that Set is built
    // from COVERED[].gate — so an unmappable command means the two have drifted.
    // SO #34c: that is its own state, never a pass.
    console.error(`\n❌ ${PROBE_LABEL}: ${advisoryFailures.length} gate(s) were downgraded but none maps to a COVERED entry id — advisoryGates() and COVERED have drifted. Cannot establish repairability.`);
    probeFailed = true;
  } else {
    gateStart(PROBE_LABEL);
    const t0 = Date.now();
    try {
      const o = execSync(`node scripts/check-regen-repairable.mjs --ids ${ids.join(',')}`, {
        cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'],
      });
      const ms = Date.now() - t0;
      timings.push([PROBE_LABEL, ms]);
      gatePass(`✓ (${ms}ms)`);
      console.log('\n' + o.toString().trim() + '\n');
    } catch (e) {
      const ms = Date.now() - t0;
      timings.push([PROBE_LABEL, ms]);
      gateFail(`✗ (${ms}ms)`);
      console.log('\n' + ((e.stdout?.toString() || '') + (e.stderr?.toString() || '')).trim() + '\n');
      probeFailed = true;
    }
  }
}

// The probe blocks in EVERY mode, --keep-going included: an unrepairable stale
// artifact is a red main, and --keep-going exists to see every result, not to
// waive one. (`--expect-red` deliberately does not reach it — it waives named
// GATES entries, and this is not one.)
if (probeFailed) {
  console.error(`\n❌ preflight FAILED at: ${PROBE_LABEL}. Fix it before pushing (this would have failed CI on main).`);
  process.exit(1);
}

if (failed && !KEEP_GOING) {
  console.error(`\n❌ preflight FAILED at: ${failed}. Fix it before pushing (this would have failed CI).`);
  process.exit(1);
}

// ── Advisory summary: shared derived artifacts stale on a PR ────────────────
// Printed AFTER the pass/fail verdict so it can never be scrolled past unseen.
// This is a notice, not a failure: SO #35 forbids a shard from regenerating
// these, and derived-artifacts-regen.yml repairs them on main.
if (advisoryFailures.length) {
  console.log(`\n⚠️  ${advisoryFailures.length} SHARED DERIVED ARTIFACT(S) STALE — advisory in this PR context, BLOCKING on main:`);
  for (const [label] of advisoryFailures) console.log(`    ⚠ ${label}`);
  console.log('    These are single-writer artifacts (SO #35). ⛔ Do NOT regenerate them in a shard PR —');
  console.log('    that is the merge-ref conflict that silently removed CI from PR #1199 (SO #34c).');
  console.log("    main's Derived Artifacts Regen workflow owns them and will commit the fix after merge.");
}

// ── Advisory (non-blocking): worker vendor owed ─────────────────────────────
// VENDOR-OWED-ADVISORY-1: an assembled chaingraph.json change means the worker
// repo's freshness gate (check-vendor-fresh.mjs) will read RED until the batched
// vendor land runs — an expected window, not breakage. De-noise it here so a
// diagnosis isn't burned re-discovering that every time (see board/done/CW-1B.md).
// Exit 0 always — this NEVER blocks, NEVER fails, NEVER becomes a gate.
try {
  const touched = new Set();
  execSync('git diff --name-only HEAD', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().split('\n').forEach(f => f && touched.add(f));
  execSync('git diff --name-only --cached', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().split('\n').forEach(f => f && touched.add(f));
  try {
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    execSync(`git diff --name-only ${base} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().split('\n').forEach(f => f && touched.add(f));
  } catch { /* no upstream configured — uncommitted/staged diff already covers local work */ }

  if (touched.has('chaingraph/chaingraph.json')) {
    console.log('\n📦 ADVISORY: assembled chaingraph.json changed — a worker vendor land is now OWED.');
    console.log('   Expect the worker freshness gate (check-vendor-fresh.mjs) to read RED until the');
    console.log('   batched ASSEMBLE+LAND vendor run lands. That window is expected, not breakage.');
  }
} catch { /* advisory best-effort only — never let it affect preflight's exit code */ }

// ── Advisory (non-blocking): L1 chain edge contracts ────────────────────────
// CHAIN-FV-L1-1. Ladder level L1 = "edge contracts machine-checked" — ⛔ NOT
// "formally verified" (L2 contract composition and L3 end-to-end properties are
// separate, unbuilt levels). Reports the per-chain verdict spread so a new or
// re-ordered chain that contradicts the node consumes/feeds map is visible
// pre-push. ADVISORY BY DESIGN, exit 0 always: the live baseline carries known
// L1-fail chains, and promotion to a hard gate is a SEPARATE later decision to
// be taken once that baseline is triaged — never a side effect of this line.
// ADVISORY-CRASH-DISTINCT-1: `(advisory check unavailable — skipped)` used to be
// printed for BOTH a crashed checker and a checker that ran — and it was printed
// through gatePass(), so under --quiet it was suppressed entirely. A checker that
// could not run now says so, in its own category.
const L1_LABEL = 'L1 chain edge contracts (advisory)';
gateStart(L1_LABEL);
{
  const r = runAdvisoryChecker('node scripts/check-chain-edge-contracts.mjs --quiet --json');
  let s = null;
  if (r.state !== 'UNAVAILABLE') { try { s = JSON.parse(r.out).summary; } catch { s = null; } }
  if (!s) {
    // A parseable --json report IS this checker's result. No report ⇒ no verdict,
    // whether the process died or exited 0 having printed something unreadable.
    gateUnavailable(L1_LABEL, r.state === 'UNAVAILABLE'
      ? r.reason
      : 'the checker exited but produced no parseable --json report, so there is no L1 verdict to read', r.out);
  } else {
    gatePass(`${s['L1-pass']} pass / ${s['L1-fail']} fail / ${s['L1-indeterminate']} indeterminate across ${s.chains_walked} chains (${s.edges_decided}/${s.edges_total} edges decided)`);
    if (r.state === 'WARNED') gatePass(`   ⚠ note: ${r.reason} (its documented contract is exit 0 always)`);
  }
}

// ── L2 chain contract composition: ADVISORY on existing chains, HARD on new/
//    changed ones ───────────────────────────────────────────────────────────
// CHAIN-FV-L2-1, spec §6.1. Ladder level L2 = "edge contracts composed and
// machine-checked (L2: contract composition)" — ⛔ NOT "formally verified".
// A chain whose shard file (chaingraph/graph/chains/<name>.json) was ADDED or
// EDITED in this diff must not enter/remain in the estate with an L2-fail edge
// — same split LAND-VERIFY-ADVISORY-SPLIT-1 already ships for count-drift.
// Existing, untouched chains stay advisory: L2-indeterminate never fails a
// gate at any tier (it is coverage, not wrongness), and the estate's own
// day-one measurement is that the honest surface today is mostly
// indeterminate (spec §0(c)/§5.2) — promoting that estate-wide would red
// every chain the day this ships, which spec §6.1 explicitly forbids.
// ⛔ L2-HARDLEG-BLOCKING-1 (2026-08-23) DID NOT WIDEN THAT. It closed the one way
// the HARD leg could fail to fire at all: a checker that produced no verdict while
// this diff touches a chain shard is now a hard failure instead of a printed note.
// Nothing else here changed tier — the estate's three standing L2-fail chains
// (dora-operational-resilience, rtp-participation, sme-credit-intelligence, measured
// 2026-08-23) stay exactly as advisory as they were, because they are untouched.
const L2_LABEL = 'L2 chain contract composition (advisory on existing / hard on new-changed)';
gateStart(L2_LABEL);
{
  const touchedChainFiles = new Set();
  const collectDiff = (args) => {
    try {
      execSync(`git diff --name-only ${args}`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').forEach((f) => f && touchedChainFiles.add(f));
    } catch { /* best-effort */ }
  };
  collectDiff('HEAD');
  collectDiff('--cached');
  try {
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const base = execSync(`git merge-base ${upstream} HEAD`, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    collectDiff(`${base} HEAD`);
  } catch { /* no upstream — local diff already covers it */ }

  const touchedChainNames = new Set(
    [...touchedChainFiles]
      .filter((f) => f.startsWith('chaingraph/graph/chains/') && f.endsWith('.json') && !f.includes('/_fixtures/'))
      .map((f) => f.slice('chaingraph/graph/chains/'.length, -'.json'.length)),
  );

  const r = runAdvisoryChecker('node scripts/check-chain-l2-contracts.mjs --quiet --json');
  let rep = null;
  if (r.state !== 'UNAVAILABLE') { try { rep = JSON.parse(r.out); } catch { rep = null; } }

  // L2-HARDLEG-BLOCKING-1: ONE decision function answers the blocking question, and
  // the self-test above drives that same function. ⛔ Never re-derive it inline here.
  const leg = decideL2HardLeg(rep, touchedChainNames);
  const noVerdictReason = r.state === 'UNAVAILABLE'
    ? r.reason
    : 'the checker exited but produced no parseable --json report, so there is no L2 verdict to read';

  if (!rep) {
    // ADVISORY-CRASH-DISTINCT-1. ⚠ NAME WHAT IS LOST, not just that something is:
    // this block carries a HARD leg (touched chains must not enter with an L2-fail
    // edge), and a checker that cannot run silently takes that leg down with it.
    // ⛔ L2-HARDLEG-BLOCKING-1 CLOSED THAT: when the leg HAS subjects, a checker that
    // produced no verdict is now a hard failure, not a note. When it has none, the
    // loss is advisory-only and the exit code is still unchanged.
    if (leg.block) {
      gateFail(`❌ BLOCKED — ${noVerdictReason}`);
      console.error(`\n❌ L2 HARD GATE (no verdict): this diff adds/edits ${leg.subjects.length} chain shard(s) and the L2`);
      console.error('   checker produced no report, so the "a new/changed chain must not enter with an L2-fail');
      console.error('   edge" leg (spec §6.1) did NOT run over them. An unrun hard leg is an ABSENT result,');
      console.error('   never a pass (SO #34c):');
      for (const n of leg.subjects) console.error(`   ? ${n}: UNCHECKED — no L2 verdict exists for this chain`);
      console.error(`   ↳ ${noVerdictReason}`);
      const detail = (r.out || '').trim();
      if (detail) console.error('\n' + detail + '\n');
      console.error('   Fix: repair the checker, then re-run —');
      console.error('        node scripts/check-chain-l2-contracts.mjs --quiet --json');
      console.error('   ⛔ Not waivable by --keep-going: this is discovered after the gate loop, exactly like');
      console.error('      the L2-fail leg below, and for the same reason.');
      process.exit(1);
    }
    gateUnavailable(L2_LABEL, `${noVerdictReason} — the new/changed-chain HARD leg had no subject either (this diff adds/edits no chain shard), so nothing HARD was lost here; only the advisory estate-wide picture`, r.out);
  } else {
    const s = rep.summary;
    gatePass(`L2-G: ${s['L2-pass']} pass / ${s['L2-fail']} fail / ${s['L2-indeterminate']} indeterminate / ${s['L2-not-applicable']} not-applicable across ${rep.target_set_size} target chains (${s.edges_pass}/${s.edges_in_scope} in-scope edges pass, ${s.edges_not_applicable} n/a)`);
    // ⛔ Print L2-S and the authoring worklist too. A summary showing only L2-G would silently hide the
    // coupling that actually decides on this estate — and its fails, which are advisory on existing
    // chains but hard the moment a touched chain carries one (they land in chains[].findings, below).
    if (rep.l2s) gatePass(`   L2-S: ${rep.l2s['L2S-pass']} pass / ${rep.l2s['L2S-fail']} fail / ${rep.l2s['L2S-indeterminate']} indeterminate over ${rep.l2s.shared_fields_examined} shared input fields, estate-wide`);
    if (rep.l2g_authoring) gatePass(`   L2-G authoring worklist: ${rep.l2g_authoring.open_gate_edges} open gate rules over ${rep.l2g_authoring.distinct_producers} producers ⇒ ${rep.l2g_authoring.batches_required} batches`);

    if (leg.block) {
      console.error(`\n❌ L2 HARD GATE: ${leg.fails.length} new/changed chain(s) carry an L2-fail edge (spec §6.1 — new chains must not enter with a failing composition):`);
      for (const c of leg.fails) console.error(`   ✗ ${c.name}: ${c.findings.map((f) => f.code).join(', ')}`);
      // Unconditional exit, independent of --keep-going: this is discovered AFTER the main gate loop
      // (and its own keep-going accounting) has already run, so there is no later checkpoint that
      // would otherwise turn a recorded `failed` value into a non-zero exit code.
      process.exit(1);
    } else if (leg.unassessed.length) {
      // L2-HARDLEG-BLOCKING-1. ⚠ The pre-existing silent green inside this leg: the checker reads
      // the ASSEMBLED chaingraph/chaingraph.json, and a PR never regenerates it (SO #35 single
      // writer), so a brand-new chain shard is absent from the report — and the old line below
      // still said "checked, none L2-fail" about a chain nothing had assessed. It now SAYS SO.
      // ⛔ Deliberately NOT blocking: that would red every additive chain PR by construction, for
      // a shard the main-side assembler has not reached yet. Reported, never claimed as checked.
      gateFail(`   ⚠ ${leg.unassessed.length} of ${leg.subjects.length} touched chain shard(s) NOT CHECKED — absent from the assembled chaingraph.json this checker reads:`);
      for (const n of leg.unassessed) console.log(`       ? ${n} (shard not yet assembled — SO #35 single writer; no L2 verdict exists for it)`);
      if (leg.subjects.length > leg.unassessed.length) {
        console.log(`       ✓ the other ${leg.subjects.length - leg.unassessed.length} touched chain shard(s) were checked, none L2-fail.`);
      }
    } else if (leg.subjects.length) {
      gatePass(`   ✓ ${leg.subjects.length} touched chain shard(s) checked, none L2-fail.`);
    }
  }
}

// ── Advisory (non-blocking): version-prose drift ────────────────────────────
// The version-of-record gate (spec-version-consistency) enforces the <meta>
// marker. This --remnants pass surfaces stray vX.Y strings in PROSE so a spec
// bump doesn't leave the hub/spec pages describing an old version. It is NOISY
// (legitimately flags the AP2 *protocol* version + OCG layer versions), so it's
// ADVISORY, not a gate — eyeball it after a spec bump.
// ADVISORY-CRASH-DISTINCT-1: this one was the sharpest case of the defect. The
// script exits 1 when surfaces are genuinely out of sync and 2 on its own FATAL
// diagnosis — both REAL results — yet every one of those, plus a crash and a
// missing file, printed the same "(advisory check unavailable — skipped)". The
// findings the checker did produce were thrown away with the ones it could not.
const VERSION_PROSE_LABEL = 'version-prose drift (advisory)';
gateStart(VERSION_PROSE_LABEL);
{
  const r = runAdvisoryChecker('node chaingraph/standard/spec-version-consistency.mjs --remnants');
  if (r.state === 'UNAVAILABLE') {
    gateUnavailable(VERSION_PROSE_LABEL, r.reason, r.out);
  } else if (r.state === 'WARNED') {
    // Ran and reported. Advisory, exactly as before — this NEVER blocks.
    gateFail(`⚠ ADVISORY — ${r.reason}`);
    console.log('\n' + r.out.trim() + '\n');
  } else {
    gatePass('see `node chaingraph/standard/spec-version-consistency.mjs --remnants` after any spec-version bump');
  }
}

// ── ADVISORY-CRASH-DISTINCT-1: checkers that produced NO result ─────────────
printUnavailableBlock();

const UNAVAILABLE_CLAUSE = unavailableClause(unavailableAdvisories.length);
if (KEEP_GOING && waivedCount) {
  // Reached only via --expect-red: every gate ran, the declared one(s) are still
  // red, and saying "PASSED" here would be the exact overclaim this mode removes.
  console.log(`\n⚠️  preflight COMPLETE — every gate reached; ${waivedCount} DECLARED-RED gate(s) waived (${EXPECT_RED.join(', ')}), every other gate green.${UNAVAILABLE_CLAUSE}`);
  console.log('   This is NOT an unqualified pass. The waived gate(s) above are still red.');
} else {
  console.log(`\n✅ preflight PASSED — all hard CI gates green. Safe to push.${UNAVAILABLE_CLAUSE}`);
}

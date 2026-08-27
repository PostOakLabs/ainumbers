#!/usr/bin/env node
// check-workflow-gate-parity.mjs — CI ↔ preflight gate parity, on TWO axes.
//
//   AXIS 1 — PRESENCE (2026-07-24, original).  Fail if a BLOCKING CI workflow
//   runs a `node <script>` gate that scripts/preflight.mjs does NOT run locally.
//
//   AXIS 2 — STATUS (WORKFLOW-GATE-PARITY-ASSERT-1, 2026-08-23).  Fail if the
//   SAME gate command is ADVISORY at one call site and BLOCKING at another, in a
//   context both call sites can reach, WITHOUT that divergence being declared.
//
// WHY AXIS 1: preflight.mjs is the pre-push hook and claims "green preflight ⇒
// green CI". That held only by hand — an audit (2026-07-24) found two node gates
// in CI that preflight never ran (verify-proposals.mjs, the Node leg of
// check-engine-parity.mjs), the same drift class that let the worker repo's §23
// gate reach a red master. The existing check-generator-coverage.mjs guard only
// covers `--check` generators, so test/verify-shaped gates slipped past it.
//
// WHY AXIS 2: presence parity is not enough, because RUNNING a gate and BLOCKING
// on it are different things and they are decided SEPARATELY at every call site.
// MERGEQUEUE-GATE-PARITY-1 (PR #1488) proved the mechanism at file and line:
// "is this gate blocking?" is a property of the CALL SITE, not of the gate. It
// fixed variant 1 (merge_group advisory vs push blocking on an identical SHA).
// This is variant 4 — advisory in preflight, hard in CI:
//
//     scripts/gen-registry-kernel-resolve.mjs --check
//        · derived-artifacts.mjs COVERED id 'registry-kernel-resolve'
//          ⇒ in advisoryGates() ⇒ preflight.mjs DOWNGRADES it on a branch
//        · land-verify.yml invokes it RAW ⇒ hard-red on the same PR
//
// ASSEMBLE-LAND-ART231-1 deferred a missing registry record to main's writer on
// the (locally correct) reading that the gate was advisory, and
// `land-verify / required` stayed red until the record was written in-PR. That
// incident is SO #54; this axis is its mechanical enforcement.
//
// THE REMEDY WAS ALREADY SPECIFIED AND NEVER IMPLEMENTED. run-gate.mjs's own
// header says, of itself: "This wrapper is the ONE place the split lives for CI
// workflow steps, so check-workflow-gate-parity.mjs can assert every derived
// gate in every workflow goes through it instead of re-deriving the logic per
// file." Axis 2 is that assertion, plus the declaration escape hatch the row
// requires, because DIVERGENCE IS NOT AUTOMATICALLY A DEFECT — a gate genuinely
// advisory locally and blocking in CI can be a deliberate choice. What is a
// defect is UNDECLARED divergence.
//
// ⛔ THIS FILE CHANGES NO GATE'S STATUS. It only asserts that each status is
// stated once and agrees with itself. Promoting a gate from advisory to blocking
// is a hard-gate decision (L2-HARDLEG-BLOCKING-1), not this checker's.
//
// ── THE STATUS MODEL ──────────────────────────────────────────────────────────
// Two statuses, and exactly two mechanisms produce them:
//   'blocking'        — a raw invocation. Non-zero exit fails the run, always.
//   'advisory-on-pr'  — the SPLIT: warn+exit 0 in a PR/merge_group context,
//                       block on main. Produced by exactly one mechanism per
//                       call site — `node scripts/run-gate.mjs <cmd>` in a
//                       workflow, or membership in advisoryGates() for
//                       preflight.mjs (which applies the same split inline).
//
// CONTEXT REACHABILITY IS PART OF THE COMPARISON, not an afterthought. A
// workflow with no `pull_request` / `merge_group` trigger only ever evaluates in
// a MAIN context, where 'advisory-on-pr' and 'blocking' are behaviourally
// IDENTICAL. A raw invocation there is therefore consistent BY CONSTRUCTION and
// is not a divergence — deploy-to-dreamhost.yml (push-to-main only) invokes 11
// advisory gates raw and not one of them is a defect. Only call sites that share
// a PR-reachable context can disagree.
//
// A THIRD MECHANISM EXISTS AND IS DELIBERATELY NOT MODELLED AS A DIVERGENCE:
// some gates carry the split INSIDE the script (check-compute-proof-coverage.mjs
// and check-kernel-coverage.mjs call isMainContext() themselves). Those are
// invoked raw at every call site, so every call site agrees; the script is the
// single writer of its own status and there is nothing here to drift.
//
// ── NO SILENT GREEN (SO #34c: absence is a distinct state, never a pass) ──────
// Every way this checker could quietly conclude "consistent" without measuring
// anything is closed by an explicit assertion:
//   (a) UNCLASSIFIED WORKFLOW — every file under .github/workflows must appear
//       in BLOCKING_WORKFLOWS or NOT_A_GATE. A new workflow cannot arrive
//       unmeasured. (The 2026-08-16 prose sweep in this file's comments had
//       already rotted: 5 of 22 workflows were absent from it.)
//   (b) STALE CLASSIFICATION / DECLARATION — every workflow name and every
//       declaration key must resolve to something that actually exists, so an
//       exemption cannot outlive the call site it excused.
//   (c) UNCALLED ADVISORY GATE — an entry in advisoryGates() invoked at ZERO
//       call sites is not "consistent", it is a gate that never runs. It must
//       be declared in NO_CALL_SITE with a reason.
//   (d) ARGUMENT DRIFT — a call site invoking an advisory gate's SCRIPT with a
//       different argument string is NOT silently "some other command". Exact
//       string grouping would make `foo.mjs --check --strict` invisible to a
//       comparison against `foo.mjs --check`. Every such sibling must be
//       declared in DISTINCT_LEGS as a deliberately separate gate leg.
//   (e) AN UNMODELLED SOFTENER — `continue-on-error:`, `|| true`, `set +e` on a
//       gate step in a blocking workflow is a THIRD way to make a gate advisory
//       that this model does not know about. Any occurrence must be declared.
//   (f) ACCOUNTING — every advisory gate lands in exactly one census bucket and
//       the buckets must sum to the total, or the run fails as `uncategorised`.
//
// SCOPE: node-invoked script gates only (`node <path>.mjs|.js`) — the drift
// class that has actually bitten us. Python/shell gates and non-node engine legs
// (Bun, QuickJS via `bun run`/`qjs`) are out of scope by construction: they
// don't match the `node ` prefix, so they're never demanded of preflight.
// Zero-dep, text-based.
//
// USAGE
//   node scripts/check-workflow-gate-parity.mjs                 — check (exit 1 on drift)
//   node scripts/check-workflow-gate-parity.mjs --census        — print the full call-site census
//   node scripts/check-workflow-gate-parity.mjs --no-declarations
//        — ignore DECLARED_DIVERGENCES. The SO #40(b) RED lever: proves the
//          assertion still SEES the declared cases instead of having been
//          quietly narrowed until nothing matches.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gitEnv } from "./_git-env-lib.mjs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WF = resolve(ROOT, ".github/workflows");
const PREFLIGHT = resolve(ROOT, "scripts/preflight.mjs");

export const HARD = "blocking";
export const SPLIT = "advisory-on-pr";
const PREFLIGHT_SITE = "scripts/preflight.mjs";

// Workflows that gate a merge or deploy (push/PR). Scheduled/mirror/publish/SAST
// workflows are not merge gates and are excluded — but they are no longer
// excluded by SILENCE: see NOT_A_GATE below, which must cover every remaining
// file so the two lists together account for .github/workflows exhaustively.
//
// JSDOC-CHECKJS-PREFLIGHT-1 SWEEP (2026-08-16) — original classification of
// every workflow, kept for its reasoning. Two classes only:
// `pr-gate-not-covered` (runs on pull_request and/or a push that can red a PR or
// main — belongs in BLOCKING_WORKFLOWS, or in CI_ONLY below with a NAMED
// physical reason if its node gate genuinely cannot run pre-push) vs
// `not-a-gate` (schedule/dispatch/deploy/sync — never blocks a merge, so parity
// has nothing to check).
//
//   pr-gate-not-covered, ADDED to BLOCKING_WORKFLOWS this sweep:
//     - jsdoc-checkjs.yml     — the incident this row exists to fix (see gate
//                               above); node scripts/jsdoc-checkjs-gate.mjs,
//                               now also in preflight.mjs.
//     - c2patool-oracle.yml   — pull_request (paths-filtered) + push main;
//                               node scripts/c2patool-oracle-compare.mjs, but
//                               that gate needs a downloaded+sha256-verified
//                               c2patool RUST BINARY, not npx-fetchable — see
//                               CI_ONLY below.
//     - ci-anchor.yml         — pull_request, no paths filter, is itself the
//                               required-status-check anchor (SO #22); zero
//                               `node` gates in its body (one `echo`), so
//                               listing it here documents the classification
//                               with no parity delta.
//     - zizmor.yml            — pull_request + push main (paths-filtered);
//                               runs a fetched Rust binary via a pinned
//                               Action, zero `node` gates in its body, so
//                               listing it here documents the classification
//                               with no parity delta.
//   pre-existing, already covered:
//     - deploy-to-dreamhost.yml, html-verify.yml, land-verify.yml,
//       scripts-verify.yml, cross-engine-parity.yml, proposals-verify.yml
const BLOCKING_WORKFLOWS = [
  "deploy-to-dreamhost.yml",
  "html-verify.yml",
  "land-verify.yml",
  "scripts-verify.yml",
  "cross-engine-parity.yml",
  "proposals-verify.yml",
  "jsdoc-checkjs.yml",
  "c2patool-oracle.yml",
  "ci-anchor.yml",
  "zizmor.yml",
];

// Every OTHER workflow, with the reason it gates no merge. BLOCKING_WORKFLOWS ∪
// NOT_A_GATE must equal the tracked contents of .github/workflows EXACTLY, both
// directions — an unclassified new workflow is a hard failure, and a stale entry
// for a deleted workflow is too. Before WORKFLOW-GATE-PARITY-ASSERT-1 this
// classification existed only as prose in the comment above, and had already
// rotted: automerge-label.yml, fullsuite-schedule.yml, mutation-full-scheduled.yml,
// ruleset-apply.yml and ruleset-drift-gate.yml were all absent from it.
const NOT_A_GATE = new Map([
  ["automerge-label.yml",
    "pull_request: [labeled] automation that PERFORMS the merge (SO #37's label path); " +
    "it is not a required status check and blocks nothing."],
  ["deploy-docs.yml",
    "push main only — deploys the docs subdomain post-merge."],
  ["deploy-drift-check.yml",
    "schedule + workflow_dispatch only."],
  ["derived-artifacts-regen.yml",
    "push main only — the SO #35 single-writer regen, post-merge."],
  ["fullsuite-schedule.yml",
    "schedule (weekly) + workflow_dispatch only; steps are continue-on-error by design " +
    "so the whole suite reports rather than stopping at the first red."],
  ["helm-guide-freshness-schedule.yml",
    "schedule only."],
  ["mutation-full-scheduled.yml",
    "schedule (nightly) + workflow_dispatch only — full-estate mutation scan, reports."],
  ["prepush-attestation.yml",
    "push main + workflow_dispatch only, so it never gates a merge. Its node gate " +
    "(check-prepush-attestation.mjs) is main-side BY CONSTRUCTION: it verifies git notes " +
    "on commits that exist only after a merge, and the note it reads is written by the very " +
    "hook that would invoke it. Pre-push there is nothing to check, so parity has nothing to " +
    "demand (PREPUSH-ATTEST-CHECK-1)."],
  ["ruleset-apply.yml",
    "push main (.github/rulesets/** only) + workflow_dispatch — applies a ruleset after merge."],
  ["ruleset-drift-gate.yml",
    "schedule (weekly) + workflow_dispatch only — reports ruleset drift, blocks no merge."],
  ["standards-watch.yml",
    "schedule + workflow_dispatch only."],
  ["sync-chaingraph-spec.yml",
    "push main only — post-merge mirror sync."],
]);

// node gates that legitimately run ONLY in CI, each with the reason it cannot run
// pre-push. Keep tight — every entry is a hole in "green preflight ⇒ green CI".
const CI_ONLY = new Map([
  ["c2patool-oracle-compare.mjs",
    "needs a downloaded + sha256-verified c2patool RUST BINARY (c2patool-oracle.yml) — " +
    "not npx-fetchable like TypeScript, and this repo installs no CI-only binaries pre-push."],
  ["check-ci-relevant.mjs",
    "always-report CI shape's `relevant` job helper — decides whether a path-filtered " +
    "pull_request should run its substantive job. Reads github.event.pull_request base/head " +
    "SHAs from env:, meaningless outside an actual PR event; always exits 0 (never a pass/fail " +
    "gate, so it has nothing preflight.mjs could usefully assert)."],
  ["check-deploy-superseded.mjs",
    "DEPLOY-REGEN-RACE-1's classifier for deploy-to-dreamhost.yml's `supersede` job. MAIN-ONLY BY " +
    "CONSTRUCTION, which is the named physical reason: it answers \"is this push-to-main Deploy run " +
    "superseded by the commit derived-artifacts-regen.yml is about to push?\", and on a branch there is no " +
    "regen bot to race — nothing exists for it to measure. It is also not a gate: it always exits 0 and its " +
    "only output is a job-level `superseded` flag (standing down is the privilege, so every unknown resolves " +
    "to \"do not stand down\" = today's behaviour). Its pre-push coverage is its paired control, " +
    "scripts/check-deploy-superseded.test.mjs, which IS in preflight.mjs's GATES and whose last block " +
    "re-derives the gate set from the real workflow text, so this entry is not a measurement hole."],
  ["run-gate.mjs",
    "LAND-VERIFY-ADVISORY-SPLIT-1 dispatcher, not a gate itself — it wraps the SAME command " +
    "strings this regex already extracts from the workflow text (e.g. verify-counts.mjs, " +
    "check-nav-reachability.mjs), which land on preflight.mjs's own parity requirement via " +
    "their own basenames. preflight.mjs applies the identical PR-advisory/main-blocking split " +
    "inline via derived-artifacts.mjs's isMainContext()/advisoryGates() (no separate CLI " +
    "invocation needed locally), so run-gate.mjs itself has nothing for preflight to run."],
]);

// ── DECLARATION SYNTAX (axis 2) ───────────────────────────────────────────────
// A divergence is DECLARED by an entry keyed `"<workflow file> :: <command>"`,
// where <command> is the whitespace-normalised command as it appears in the
// workflow. Every declaration MUST resolve to a live call site whose status
// genuinely differs from preflight.mjs's — a declaration for a call site that no
// longer diverges is STALE and fails, so an exemption cannot outlive its reason.
//
// ⛔ A declaration RECORDS a decision. It does not MAKE one, and adding one is
// not a way to silence a gate you have just broken. `ci` and `preflight` state
// the two observed statuses and are themselves asserted against what is measured.
const DECLARED_DIVERGENCES = new Map([
  ["land-verify.yml :: node scripts/gen-registry-kernel-resolve.mjs --check", {
    ci: HARD,
    preflight: SPLIT,
    decided: "2026-08-23",
    by: "WORKFLOW-GATE-PARITY-ASSERT-1 — recording, not deciding.",
    why:
      "land-verify.yml states the CI side's reason inline: unlike counts, registry/kernel/<hex>.json " +
      "IS repairable inside the branch (--write for a missing/stale record, git rm for an orphan), so " +
      "no PR is structurally unable to satisfy it and SO #35's hand-off to the main-side writer does " +
      "not apply. preflight.mjs downgrades it because the same command is derived-artifacts.mjs " +
      "COVERED id 'registry-kernel-resolve', which exists for the REGEN path. The two sides are " +
      "answering different questions and the local one under-reports. ⚠ CONSEQUENCE FOR A SESSION: " +
      "a local ⚠ ADVISORY on this gate does NOT mean it is safe to defer — land-verify/required will " +
      "stay red (SO #54, ASSEMBLE-LAND-ART231-1). Aligning the two is a hard-gate decision and belongs " +
      "to L2-HARDLEG-BLOCKING-1, not here.",
  }],
  ["land-verify.yml :: node scripts/assemble-chaingraph.mjs --check", {
    ci: HARD,
    preflight: SPLIT,
    decided: "2026-08-23",
    by: "WORKFLOW-GATE-PARITY-ASSERT-1 — recording, not deciding.",
    why:
      "The hard red is the DESIGNED signal, stated in land-verify.yml's own header (KERNELCI-1): " +
      "'an EDITED-EXISTING-kernel PR will now go RED on its own PR, because the committed " +
      "chaingraph.json still holds the old digest until the next assemble-and-land step regenerates " +
      "it from shards. That red is the correct signal — edited-existing-shard PRs never self-merge.' " +
      "Downgrading it to advisory on a PR would re-open exactly the self-merge path RIDER-KERNEL's " +
      "DRAFT-PR rule exists to keep visible. preflight.mjs downgrades it via COVERED id 'chaingraph' " +
      "because SO #35 forbids a shard PR from running the --enroll regen locally. Same shape as the " +
      "entry above: the local surface under-reports.",
  }],
]);

// Commands that invoke an advisory gate's SCRIPT but are a DIFFERENT gate leg,
// deliberately hard at every call site. Without this list, exact-string grouping
// would treat them as unrelated commands and an argument-drift typo on an
// advisory gate would read as "consistent" because it matched nothing (hole (d)).
const DISTINCT_LEGS = new Map([
  ["node scripts/check-nav-reachability.mjs", {
    sibling: "node scripts/check-nav-reachability.mjs --baseline-check",
    decided: "2026-08-16 (NAV-ISLAND-1), recorded here 2026-08-23",
    why:
      "Two legs of one script, opposite statuses ON PURPOSE. The bare invocation is the NEW-ISLAND " +
      "check: hard in every context, because an unlinked page is a CONTENT defect the PR itself must " +
      "fix and the main-side regen cannot repair it (PR #1309 shipped integrator-profile.html unlinked " +
      "and green while this leg was advisory). --baseline-check is the SHARED-DERIVED-ARTIFACT " +
      "freshness leg over nav-island-baseline.json, which a PR branch must NOT regenerate (SO #35), so " +
      "that one is split via run-gate.mjs. Both legs are invoked identically in preflight.mjs and " +
      "html-verify.yml, so neither leg diverges — this entry exists to prove the pairing was examined.",
  }],
]);

// advisoryGates() entries invoked at ZERO call sites. An uncalled gate is not
// consistent, it is absent (SO #34c) — so it must be named here, never inferred.
const NO_CALL_SITE = new Map([
  ["node scripts/sync-stats.mjs", {
    found: "2026-08-23 by WORKFLOW-GATE-PARITY-ASSERT-1's census.",
    why:
      "REPORTED, NOT RESOLVED — wiring it would be adding a gate, which is outside this row's fence. " +
      "derived-artifacts.mjs COVERED id 'stats' declares this command as its `gate:`, and " +
      "repo/CLAUDE.md's Wave Completion Checklist item 7 tells a session to run it before commit, but " +
      "NO call site invokes it: not scripts/preflight.mjs's GATES array, not any workflow. Its regen " +
      "half (`node scripts/sync-stats.mjs --fix`) IS wired into derived-artifacts-regen.yml, so on " +
      "main the drift is repaired silently and unmeasured, and nothing anywhere reports it. Wiring it " +
      "into preflight is a hard-gate decision (L2-HARDLEG-BLOCKING-1's scope), so this row declares it " +
      "and states it rather than changing coverage.",
  }],
]);

// Softening mechanisms other than run-gate.mjs, inside a BLOCKING workflow.
// Currently empty and that is a measured fact, not an assumption: no blocking
// workflow carries continue-on-error / `|| true` / `set +e` on a gate step
// today. A new one must be declared here or this gate goes red — otherwise a
// third status mechanism could appear that the model above cannot see (hole (e)).
const DECLARED_SOFTENERS = new Map([]);

// ── extraction helpers (pure; the .test.mjs drives these directly) ────────────

/** Whitespace-normalise a shell command and canonicalise path separators. */
export function normalizeCmd(s) {
  return String(s).trim().replace(/\s+/g, " ").replace(/\\/g, "/");
}

/** The script path a `node …` / `python …` command invokes, or null. */
export function scriptOf(cmd) {
  const m = normalizeCmd(cmd).match(/^(?:node|python)\s+(\S+\.(?:mjs|js|py))(?:\s|$)/);
  return m ? m[1] : null;
}

/** Peel a `node scripts/run-gate.mjs <cmd>` wrapper. */
export function unwrapRunGate(cmd) {
  const n = normalizeCmd(cmd);
  const m = n.match(/^node\s+(?:\.\/)?scripts\/run-gate\.mjs\s+(.+)$/);
  return m ? { wrapped: true, inner: normalizeCmd(m[1]) } : { wrapped: false, inner: n };
}

/**
 * Can this workflow ever run in a PR / merge-queue context?
 * ⚠ FAILS CLOSED, mirroring derived-artifacts.mjs's isMainContext(): an `on:`
 * block we cannot parse returns true, so an unreadable workflow is COMPARED
 * rather than skipped. Being excused from the comparison is the privilege here,
 * and it has to be affirmatively earned.
 */
export function prReachable(text) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => /^on:/.test(l));
  if (start === -1) return { value: true, reason: "no `on:` block found — failing closed" };
  const keys = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\S/.test(line)) break;                       // dedent to column 0 → out of `on:`
    const m = line.match(/^ {2}([a-z_]+):/);           // a top-level trigger key
    if (m) keys.push(m[1]);
  }
  if (!keys.length) return { value: true, reason: "`on:` block parsed to zero triggers — failing closed" };
  const pr = keys.filter((k) => ["pull_request", "pull_request_target", "merge_group", "workflow_call"].includes(k));
  return pr.length
    ? { value: true, reason: `triggers: ${pr.join(", ")}` }
    : { value: false, reason: `main-only triggers: ${keys.join(", ")}` };
}

/**
 * Every shell command line inside a `run:` step, with its 1-based line number.
 * ⚠ Deliberately NOT a whole-file regex: the file is full of `# Fix: node
 * scripts/gen-chain-index.mjs` remediation hints inside comments, and counting
 * those as invocations would invent call sites that do not exist.
 */
export function workflowCommands(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  let inBlock = false;
  let blockIndent = 0;
  const push = (raw, lineNo) => {
    for (const piece of String(raw).split("&&")) {
      const c = normalizeCmd(piece);
      if (c) out.push({ line: lineNo, command: c });
    }
  };
  lines.forEach((ln, idx) => {
    const inline = ln.match(/^(\s*)(?:-\s+)?run:\s*(\|[-+]?|>[-+]?)?\s*(.*)$/);
    if (inline) {
      inBlock = Boolean(inline[2]);
      blockIndent = inline[1].length;
      if (inline[3]) push(inline[3], idx + 1);
      return;
    }
    if (!inBlock) return;
    if (!ln.trim()) return;
    if (ln.match(/^(\s*)/)[1].length <= blockIndent) { inBlock = false; return; }
    if (/^\s*#/.test(ln)) return;
    push(ln, idx + 1);
  });
  return out;
}

/**
 * Command strings from preflight.mjs's GATES array literal, with line numbers.
 * Same extraction technique as check-generator-coverage.mjs — comment lines are
 * BLANKED (not removed) so line numbers survive, then every fully-quoted string
 * inside `const GATES = [ … ];` that starts `node `/`python ` is a command. A
 * commented-out GATES row is not an execution and must not count.
 */
export function preflightCommands(src) {
  const blanked = String(src).split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const m = blanked.match(/const GATES = \[([\s\S]*?)\n\];/);
  if (!m) return { commands: new Map(), found: false };
  const offset = m.index + m[0].indexOf(m[1]);
  const commands = new Map();
  const quoted = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  let q;
  while ((q = quoted.exec(m[1]))) {
    const content = q[1] ?? q[2] ?? q[3] ?? "";
    if (!/^(node|python)\s+/.test(content)) continue;
    const cmd = normalizeCmd(content);
    const line = blanked.slice(0, offset + q.index).split("\n").length;
    if (!commands.has(cmd)) commands.set(cmd, []);
    commands.get(cmd).push(line);
  }
  return { commands, found: true };
}

/** `continue-on-error` / `|| true` / `set +e` on a gate step — the unmodelled softeners. */
export function softeners(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((ln, idx) => {
    if (/^\s*#/.test(ln)) return;
    if (/^\s*continue-on-error:\s*true\s*$/.test(ln)) {
      out.push({ line: idx + 1, kind: "continue-on-error", text: ln.trim() });
      return;
    }
    if (!/\b(node|python)\s+\S+\.(mjs|js|py)\b/.test(ln)) return;
    if (/\|\|\s*(true|:)\s*$/.test(ln)) out.push({ line: idx + 1, kind: "|| true", text: ln.trim() });
    else if (/(^|\s)set\s+\+e(\s|$)/.test(ln)) out.push({ line: idx + 1, kind: "set +e", text: ln.trim() });
  });
  return out;
}

// ── the axis-2 assertion ──────────────────────────────────────────────────────

/**
 * Build every call site's status for every command, then compare.
 *
 * @param {object} input
 * @param {Set<string>} input.advisory  advisoryGates() — the SSOT preflight uses
 * @param {Map<string,string[]>} input.preflight  command -> line numbers
 * @param {Array<{file:string,text:string,blocking:boolean}>} input.workflows
 * @param {object} [opts]
 * @param {boolean} [opts.useDeclarations=true]
 */
export function statusParity(input, opts = {}) {
  const useDeclarations = opts.useDeclarations !== false;
  const declared = useDeclarations ? (opts.declarations ?? DECLARED_DIVERGENCES) : new Map();
  const distinctLegs = opts.distinctLegs ?? DISTINCT_LEGS;
  const noCallSite = opts.noCallSite ?? NO_CALL_SITE;
  const declaredSofteners = opts.softeners ?? DECLARED_SOFTENERS;

  const advisory = input.advisory;
  const advisoryScripts = new Set([...advisory].map((c) => basename(scriptOf(c) || "")).filter(Boolean));

  /** command -> [{site, file, line, status, prContext}] */
  const sites = new Map();
  const add = (cmd, rec) => {
    if (!sites.has(cmd)) sites.set(cmd, []);
    sites.get(cmd).push(rec);
  };

  for (const [cmd, lineNos] of input.preflight) {
    for (const line of lineNos) {
      add(cmd, {
        site: PREFLIGHT_SITE, file: PREFLIGHT_SITE, line,
        status: advisory.has(cmd) ? SPLIT : HARD,
        prContext: true,   // the pre-push hook runs on a feature branch, and scripts-verify.yml runs it on PRs
        prReason: "pre-push hook on a feature branch + scripts-verify.yml on pull_request",
      });
    }
  }

  const problems = [];
  const usedDeclarations = new Set();
  const usedSofteners = new Set();
  const softenerFindings = [];

  for (const wf of input.workflows) {
    if (!wf.blocking) continue;
    const reach = prReachable(wf.text);
    for (const { line, command } of workflowCommands(wf.text)) {
      const { wrapped, inner } = unwrapRunGate(command);
      if (!scriptOf(inner)) continue;
      if (wrapped && !advisory.has(inner)) {
        problems.push({
          kind: "wrapped-not-advisory",
          detail: `${wf.file}:${line} wraps \`${inner}\` in run-gate.mjs, but that command is NOT in ` +
                  `advisoryGates(). run-gate.mjs's advisory branch can therefore never fire: the step ` +
                  `READS as a split and BEHAVES as blocking.`,
        });
      }
      add(inner, {
        site: wf.file, file: `.github/workflows/${wf.file}`, line,
        status: wrapped ? SPLIT : HARD,
        prContext: reach.value,
        prReason: reach.reason,
      });
    }
    for (const s of softeners(wf.text)) {
      const key = `${wf.file}:${s.kind}:${s.line}`;
      softenerFindings.push({ ...s, file: wf.file, key });
      if (declaredSofteners.has(key)) usedSofteners.add(key);
      else problems.push({
        kind: "undeclared-softener",
        detail: `${wf.file}:${s.line} softens a gate step by \`${s.kind}\` — a status mechanism outside ` +
                `run-gate.mjs. Declare it in DECLARED_SOFTENERS (key \`${key}\`) or remove it.`,
      });
    }
  }

  // ── divergence: two PR-reachable call sites of the SAME command disagreeing ──
  const census = { consistent: [], mainOnly: [], declared: [], undeclared: [], preflightOnly: [], uncalled: [] };
  for (const [cmd, recs] of sites) {
    const prRecs = recs.filter((r) => r.prContext);
    const statuses = new Set(prRecs.map((r) => r.status));
    if (statuses.size <= 1) continue;
    // Every PR-reachable site that disagrees with preflight (or, if preflight has
    // no entry, with the first site) needs its own declaration.
    const baseline = prRecs.find((r) => r.site === PREFLIGHT_SITE) ?? prRecs[0];
    for (const r of prRecs) {
      if (r.site === baseline.site && r.line === baseline.line) continue;
      if (r.status === baseline.status) continue;
      const key = `${r.site} :: ${cmd}`;
      const d = declared.get(key);
      if (d) {
        usedDeclarations.add(key);
        if (d.ci !== r.status || (baseline.site === PREFLIGHT_SITE && d.preflight !== baseline.status)) {
          problems.push({
            kind: "declaration-mismatch",
            detail: `declaration \`${key}\` records ci=${d.ci}/preflight=${d.preflight}, but the tree ` +
                    `measures ${r.site}=${r.status} / ${baseline.site}=${baseline.status}. The statuses ` +
                    `moved under the declaration — re-decide, don't re-word.`,
          });
        }
      } else {
        problems.push({
          kind: "undeclared-divergence",
          detail: `\`${cmd}\`\n      ${baseline.file}:${baseline.line} → ${baseline.status}\n` +
                  `      ${r.file}:${r.line} → ${r.status}\n` +
                  `      Both reachable in a PR/merge_group context, so the SAME commit gets two ` +
                  `verdicts. Wrap it in \`node scripts/run-gate.mjs\` to align, or DECLARE the ` +
                  `divergence with key:\n        "${key}"`,
        });
      }
    }
  }

  // ── stale declarations ──────────────────────────────────────────────────────
  for (const key of declared.keys()) {
    if (!usedDeclarations.has(key)) {
      problems.push({
        kind: "stale-declaration",
        detail: `declaration \`${key}\` matched no live divergence. Either the call site changed or the ` +
                `statuses now agree — delete the declaration. An exemption may not outlive its reason.`,
      });
    }
  }
  for (const key of declaredSofteners.keys()) {
    if (!usedSofteners.has(key)) {
      problems.push({ kind: "stale-declaration", detail: `DECLARED_SOFTENERS key \`${key}\` matched nothing — delete it.` });
    }
  }

  // ── hole (d): argument drift on an advisory gate's script ───────────────────
  const usedLegs = new Set();
  for (const [cmd] of sites) {
    const s = scriptOf(cmd);
    if (!s) continue;
    if (!advisoryScripts.has(basename(s))) continue;
    if (advisory.has(cmd)) continue;
    if (distinctLegs.has(cmd)) { usedLegs.add(cmd); continue; }
    const siblings = [...advisory].filter((a) => basename(scriptOf(a) || "") === basename(s));
    problems.push({
      kind: "argument-drift",
      detail: `\`${cmd}\` invokes an advisory gate's script but is not itself an advisory gate command ` +
              `(advisoryGates() has: ${siblings.map((x) => `\`${x}\``).join(", ")}). Exact-string ` +
              `comparison would treat it as an unrelated command and measure NOTHING. If it is a ` +
              `deliberately separate leg, declare it in DISTINCT_LEGS; if it is argument drift, fix it.`,
    });
  }
  for (const cmd of distinctLegs.keys()) {
    if (!usedLegs.has(cmd)) {
      problems.push({ kind: "stale-declaration", detail: `DISTINCT_LEGS entry \`${cmd}\` matched no call site — delete it.` });
    }
  }

  // ── hole (c) + (f): census + accounting over EVERY advisory gate ────────────
  const usedNoCallSite = new Set();
  for (const cmd of advisory) {
    const recs = sites.get(cmd) ?? [];
    if (!recs.length) {
      census.uncalled.push({ cmd });
      if (noCallSite.has(cmd)) usedNoCallSite.add(cmd);
      else problems.push({
        kind: "uncalled-advisory-gate",
        detail: `\`${cmd}\` is declared advisory in derived-artifacts.mjs but is invoked at NO call ` +
                `site — not preflight.mjs's GATES, not any blocking workflow. An uncalled gate is ` +
                `ABSENT, not consistent (SO #34c). Wire it, or declare it in NO_CALL_SITE.`,
      });
      continue;
    }
    const wfRecs = recs.filter((r) => r.site !== PREFLIGHT_SITE);
    const prWf = wfRecs.filter((r) => r.prContext);
    if (!wfRecs.length) { census.preflightOnly.push({ cmd, recs }); continue; }
    if (!prWf.length) { census.mainOnly.push({ cmd, recs }); continue; }
    const anyDeclared = prWf.some((r) => declared.has(`${r.site} :: ${cmd}`));
    const anyUndeclared = problems.some((p) => p.kind === "undeclared-divergence" && p.detail.includes(`\`${cmd}\``));
    if (anyUndeclared) census.undeclared.push({ cmd, recs });
    else if (anyDeclared) census.declared.push({ cmd, recs });
    else census.consistent.push({ cmd, recs });
  }
  for (const cmd of noCallSite.keys()) {
    if (!usedNoCallSite.has(cmd)) {
      problems.push({ kind: "stale-declaration", detail: `NO_CALL_SITE entry \`${cmd}\` now has a call site — delete it.` });
    }
  }

  const bucketed = census.consistent.length + census.mainOnly.length + census.declared.length
    + census.undeclared.length + census.preflightOnly.length + census.uncalled.length;
  if (bucketed !== advisory.size) {
    problems.push({
      kind: "accounting",
      detail: `census accounting FAILED CLOSED: ${bucketed} bucketed vs ${advisory.size} advisory gates. ` +
              `An uncategorised gate means this checker measured something it cannot describe.`,
    });
  }

  return { problems, census, sites, softenerFindings, bucketed, total: advisory.size };
}

// ── axis 1 (presence), unchanged ──────────────────────────────────────────────

function nodeGates(text) {
  const out = new Set();
  // `node path/to/script.mjs` or `.js`, ignoring flags/args after it.
  const re = /\bnode\s+([\w./\\-]+\.(?:mjs|js))\b/g;
  let m;
  while ((m = re.exec(text))) out.add(basename(m[1]));
  return out;
}

/**
 * Tracked workflow files. `git ls-files`, never a directory walk (SO #52).
 *
 * env: gitEnv() (GIT-ENV-LEAK-SWEEP-1) — this gate runs from preflight, which .githooks/pre-push
 * invokes from inside `git push`, and git exports GIT_DIR to a hook whenever the push comes from a
 * linked worktree (every build session here works in .wt/<row>). GIT_DIR beats `cwd`, so without
 * the scrub this would enumerate the OUTER repository's workflows and check parity against a set
 * of files belonging to a different tree.
 */
function trackedWorkflows() {
  const out = execFileSync("git", ["ls-files", "--", ".github/workflows"], { cwd: ROOT, env: gitEnv(), encoding: "utf8" });
  return out.split("\n").map((l) => l.trim()).filter(Boolean).map((p) => basename(p));
}

async function main() {
  const argv = process.argv.slice(2);
  const showCensus = argv.includes("--census");
  const useDeclarations = !argv.includes("--no-declarations");

  const problems = [];

  // ── (a)/(b) classification completeness ─────────────────────────────────────
  let tracked;
  try {
    tracked = trackedWorkflows();
  } catch (e) {
    console.error(`✗ workflow gate parity: could not enumerate .github/workflows via git ls-files: ${e.message}`);
    console.error("  Failing closed — an unenumerable workflow set cannot be asserted consistent.");
    process.exit(1);
  }
  const classified = new Set([...BLOCKING_WORKFLOWS, ...NOT_A_GATE.keys()]);
  for (const f of tracked) {
    if (!classified.has(f)) {
      problems.push(`  - UNCLASSIFIED WORKFLOW: ${f}\n      Add it to BLOCKING_WORKFLOWS (it can red a PR or main) or to\n      NOT_A_GATE with the reason it gates no merge. Silence is not a classification.`);
    }
  }
  const trackedSet = new Set(tracked);
  for (const f of classified) {
    if (!trackedSet.has(f)) problems.push(`  - STALE CLASSIFICATION: ${f} is listed here but not tracked under .github/workflows.`);
  }

  // ── axis 1: presence ────────────────────────────────────────────────────────
  const preflightSrc = readFileSync(PREFLIGHT, "utf8");
  const preflight = nodeGates(preflightSrc);
  const workflows = [];
  let totalCi = 0;
  for (const wf of BLOCKING_WORKFLOWS) {
    let text;
    try {
      text = readFileSync(resolve(WF, wf), "utf8");
    } catch {
      problems.push(`  ! workflow not found: ${wf} (update BLOCKING_WORKFLOWS)`);
      continue;
    }
    workflows.push({ file: wf, text, blocking: true });
    for (const g of nodeGates(text)) {
      totalCi++;
      if (!preflight.has(g) && !CI_ONLY.has(g)) {
        problems.push(`  - ${g}  (in ${wf}, not in preflight)`);
      }
    }
  }
  const presenceProblems = problems.length;

  // ── axis 2: status ──────────────────────────────────────────────────────────
  const { advisoryGates } = await import("./derived-artifacts.mjs");
  const advisory = new Set([...advisoryGates()].map(normalizeCmd));
  const pf = preflightCommands(preflightSrc);
  if (!pf.found) {
    problems.push("  - could not locate `const GATES = [ … ];` in scripts/preflight.mjs — failing closed rather than reporting parity over an empty local gate set.");
  }
  const r = statusParity(
    { advisory, preflight: pf.commands, workflows },
    { useDeclarations },
  );
  for (const p of r.problems) problems.push(`  - [${p.kind}] ${p.detail}`);

  // ── census ──────────────────────────────────────────────────────────────────
  const line = (b, label) => `    ${String(b.length).padStart(3)}  ${label}`;
  const censusLines = [
    `  CALL-SITE CENSUS — ${r.total} advisory-on-PR gate commands (derived-artifacts.mjs advisoryGates()):`,
    line(r.census.consistent, "same status at every PR-reachable call site"),
    line(r.census.mainOnly, "raw only in main-only workflows — consistent BY CONSTRUCTION (no shared PR context)"),
    line(r.census.preflightOnly, "invoked by preflight.mjs only — no second call site to disagree"),
    line(r.census.declared, "DIVERGENT, declared"),
    line(r.census.undeclared, "DIVERGENT, UNDECLARED"),
    line(r.census.uncalled, "invoked at NO call site (absent, not consistent)"),
  ];
  if (showCensus) {
    for (const bucket of ["consistent", "mainOnly", "preflightOnly", "declared", "undeclared", "uncalled"]) {
      const items = r.census[bucket];
      if (!items.length) continue;
      censusLines.push(`\n  ── ${bucket} (${items.length}) ──`);
      for (const it of items) {
        censusLines.push(`    ${it.cmd}`);
        for (const rec of it.recs ?? []) {
          censusLines.push(`        ${rec.status.padEnd(16)} ${rec.file}:${rec.line}   [${rec.prContext ? "PR-reachable" : "main-only"}]`);
        }
      }
    }
    censusLines.push(`\n  ── softening mechanisms outside run-gate.mjs in blocking workflows: ${r.softenerFindings.length} ──`);
  }

  if (problems.length) {
    console.error(`✗ workflow gate parity: ${problems.length} problem(s) — ${presenceProblems} presence, ${problems.length - presenceProblems} status/classification:`);
    for (const p of problems) console.error(p);
    console.error("");
    for (const l of censusLines) console.error(l);
    console.error("");
    console.error("  PRESENCE drift → add the gate to the GATES array in scripts/preflight.mjs (or, if it");
    console.error("  truly cannot run pre-push, allowlist it in CI_ONLY here with a reason).");
    console.error("  STATUS drift → wrap the CI step in `node scripts/run-gate.mjs <cmd>` to align it, or");
    console.error("  DECLARE the divergence in DECLARED_DIVERGENCES with the reason it is deliberate.");
    console.error("  ⛔ Do NOT change a gate's status to silence this — that is a hard-gate decision.");
    process.exit(1);
  }

  console.log(`✓ workflow gate parity — presence: every blocking-workflow node gate runs in preflight (${totalCi} CI gate invocations, ${CI_ONLY.size} CI-only allowlisted).`);
  console.log(`✓ workflow gate parity — status: no undeclared advisory/blocking split across call sites (${DECLARED_DIVERGENCES.size} declared, ${DISTINCT_LEGS.size} distinct leg(s), ${NO_CALL_SITE.size} uncalled).`);
  console.log(`✓ workflow classification: ${tracked.length} tracked workflows, ${BLOCKING_WORKFLOWS.length} blocking + ${NOT_A_GATE.size} not-a-gate, none unclassified.`);
  for (const l of censusLines) console.log(l);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

# CLI-RUNBOOK-1 — Headless Cline dispatch queue + GUI handoff (2026-09-09)

Companion to `research/CLINE-DISPATCH-SETUP-1.md` (the runbook: pinned `cline@3.0.61`,
gated per-run state at `~/.cline-runner/`, worktree-scoped dispatch, NDJSON receipts,
independent gate re-verification). This file TRACKS dispatchable work. Status moves
PROPOSED → READY → DISPATCHED → REPORTED → ADJUDICATED, same discipline as
`Cline/README.md`.

## Session split (decided 2026-09-09, Tim-approved)

| Lane | Tasks | Why |
|------|-------|-----|
| GUI session (VS Code Cline, browser + approval rhythm) | T1 finish, T2 | T2 needs real Chrome (96-page two-doorway probe); headless rig runs browser-disabled by design |
| CLI runbook (headless, this queue) | T4 re-issue, copyrot sweep, catalog C1–C8 | node-script + file-edit work; gated, bounded, machine-verified |

## Copy-hallmarks sweep ledger

Baseline debt: 8,563 em-dash violations over 1,529 files at start. Gate:
`node scripts/check-copy-hallmarks.mjs` (counts only go down). Each batch: fresh
worktree off `origin/main`, brief at `~/.cline-runner/run-<name>/brief.txt`, receipt
NDJSON kept per run. Batches prefer files with the SMALLEST counts first (clear whole
entries); scale batch size up as confidence grows.

| Batch | Branch | Scope | Status | Result |
|-------|--------|-------|--------|--------|
| proof-1 | `CLINE-COPYROT-PROOF-1` | 3 files | REPORTED → PUSHED to origin (PR pending) | `35d1bd57`, 8563→8560, gates re-verified green independently |
| batch-2 | `CLINE-COPYROT-BATCH-2` | ≤12 smallest-count files | REPORTED 2026-09-09 | `a0d76492` local, 12 files fixed (9 entries fully cleared), em-dash 4654→4642, 23 iters/4 min/$0, gates independently green; push pending Tim's word |
| batch-3+ | — | scale 15–25 files/run | PROPOSED | after batch-2 receipt reviewed |

Push policy for sweep branches (empirical note): full preflight ran 130 s and FAILED at
Deep-link contract on `art-330`/`art-331` (`o is not defined`) — **proven pre-existing at
base `0f95fe56`** (identical failure before the Cline commit). Per repo doctrine the push
used `git push --no-verify` with CI as backstop. This red is itself a fix-row candidate (see C9).

## T4 re-issue (READY — UNBLOCKED: T1 REPORTED 2026-09-09 via GUI, runbook may dispatch)

Original brief: `Cline/CLINE-T4-PARITY-INSTRUMENTS-COUNTERVERIFY-TASKING-2026-09-09.md`.
GUI T1 completion: `research/WEBMCP-WRAPPER-PARSE-COUNTERVERIFY-2026-09-09.md` (PARTIAL
header — live-probe sample cut short at handoff; classifier results complete, see
`research/WEBMCP-WRAPPER-PARSE-COUNTERVERIFY-RAW-2026-09-09.json`).
Runbook adaptation: worktree cwd; Cline writes deliverables INSIDE the worktree under
`report/` (headless gate fences edits to cwd — `editFilesExternally:false`); ZCode
reviews, copies to `research/PARITY-INSTRUMENTS-COUNTERVERIFY-2026-09-09.md`, and
commits. Same independence discipline: derive first, compare second, evidence classes,
RED-then-GREEN. No live-probing needed — node scripts on the worktree only.

## T2 note (stays GUI-side)

Browser-dependent (96 live pages, both doorways, fresh tabs). Do NOT re-issue headless
unless a supervised browser-enabled profile is created — unattended browser tools on a
free model are the prompt-injection surface the rig deliberately closes.

## New dispatch catalog (PROPOSED — public-repo scope, headless-safe, no browser)

| ID | Brief idea | Deliverable | Gate that verifies |
|----|------------|-------------|--------------------|
| C1 | copyrot batches (ledger above) | baseline-lowering commits | check-copy-hallmarks.mjs |
| C2 | manifest naming conformance: orphan/short-form `{number}-manifest.json` variants, `DELETE ME` audit | report in worktree `report/` | ls + gate outputs quoted |
| C3 | PII-banner presence sweep on all tools/ + guides/ (exact CONTRACT §1.3 sentence in rendered text) | report + PROPOSED rows | check-pii-banner.mjs corpus run |
| C4 | Policy Mandate export presence for in-scope tool titles (policy/rule/mandate/routing/compliance/risk/AML/KYC/gap) | report + PROPOSED rows | quoted per-tool findings |
| C5 | JSON-LD schema block presence on every hub page (CONTRACT §6.3) | report + PROPOSED rows | quoted per-hub findings |
| C6 | internal dead-anchor (fragment) audit on tools/ + guides/ links | report + PROPOSED rows | quoted anchor map |
| C7 | docs-drift: repo/CLAUDE.md + CONTRACT.md claims vs actual script names/behavior | report | quoted file:line evidence |
| C8 | LICENSE/attribution (CC BY 4.0) footer presence sweep | report + PROPOSED rows | quoted findings |
| C9 | FIX (not audit): `chaingraph/art-330-tvm-dv01.html` + `art-331-tvm-convexity.html` — `[deeplink] execution failed: o is not defined`, reds the Deep-link contract gate on main | fix commit + baseline-with-reason or true fix | check-deeplink-contract.mjs green |

Scope rule for ALL rows: public repo surfaces only (free-model usage trains on inputs —
never point a Cline run at `ainumbers-internal/`, `board/`, or private workspace docs).

## Handoff prompt (pasted to the GUI-driving GLM session 2026-09-09)

See `HANDOFF-PROMPT-1` section below — reproduced verbatim so the handoff is auditable.

### HANDOFF-PROMPT-1

SAFE-COMPLETION + HANDOFF (from the parallel ZCode session running the headless CLI runbook)

Your T1 is valuable — land it cleanly, then stop dispatching through the GUI. Exact steps:

1. FINISH T1 to a natural checkpoint. Let the in-flight live-probe batch finish; if a single probe is wedged, abort that probe, keep its partial output, and move on. Do not abandon mid-file-write.
2. Write the T1 report to C:\dev\Claude\Projects\AINumbers\research\ (same convention as T3/T5) with a status header of COMPLETED or PARTIAL, the re-derived counts (797 mapping-incomplete / 341 wrapper-detectable / 433 TODO placeholders vs the claimed 462/~415), the stratified sample design, and per-probe outcomes with evidence classes.
3. Update Cline/README.md: T1 → REPORTED (with report path); T4 → HANDED-OFF to CLI runbook (tracked in Cline/CLI-RUNBOOK-DISPATCH-QUEUE-1.md); T2 → STAYS GUI-SIDE (browser-dependent). Commit as you have been (git add -f Cline/, no push).
4. Do NOT dispatch T4 or T2. Do NOT push anything. Do NOT touch .wt/ worktrees, branch CLINE-COPYROT-PROOF-1, or branch CLINE-COPYROT-BATCH-2. Do NOT reset or delete any Cline sessions.
5. If the free provider throws a transient Unauthorized error: Retry once; if it recurs, record the failure and stop that task instead of forcing it.
6. When T1 is saved and the status commit is made, reply with exactly: DONE-HANDOFF-READY

After DONE-HANDOFF-READY, the runbook dispatches T4 headless (fresh worktree, gated approvals, machine-parsed receipt, independent gate re-verification). T2 remains yours whenever you are ready — it needs your Chrome.

# OPUS-EXTRA-DRYRUN-1 — tasking memorial (2026-09-09, window ~23:15 → 02:00 EDT hard stop)

Tim-directed single Opus 5 Extra session, dry-run discipline: **worktree builds, pushed
branches, PRs marked HOLD, nothing merged, nothing labelled into any merge queue.**
Purpose: burn pre-reset Opus quota on real estate debt; every unit parks independently;
merge decisions are Tim's, made mechanical by per-PR verification recipes.

## Collision audit (verified 23:00–23:05 EDT 2026-09-09, before dispatch)

Live lanes at audit time and why each unit is disjoint from them:

| Lane | State (evidence) | Tonight/tomorrow owns | Overlap with this brief |
|---|---|---|---|
| ORCH supervisor (Tim-dive seat) | alive, monitoring (`ORCH-STATUS.jsonl` 02:30:38Z "monitoring") | TASKING-3 dispatch, checkoffs, #1828 queue | none — claims below remove exactly the two rows its addenda hold as OPUS-class |
| GLM builders ×3 | REGZ-TABLE-SINGLE-WRITER-2 mid-delivery (long-turn) | next: REGZ-FIXTURE-YEARS-1, HELM-MCPB-1, HELM-OTEL-1 (site+helm) | none touch anchor-suite or workspace-root specs |
| Claude builder ×1 | in flight | CONF-PIN-1 → PIN-BATCH-1 (site, sole-writer registry) | none — this session does not take a lane slot; channel announce keeps ORCH counts sane |
| GLM verifier seat | ACTIVE — closed ART220 §4 at 22:5x EDT (`research/ART220-CARD-PENALTY-RECORD-2026-09-08.md` §7) | research/channel | none — ART220 is a no-go below |
| Opus verifier seat ("Omen") | advisory, mid-adjudication 281-tuple manifest/tools-list | that reconciliation | none — brief never touches manifest/tools-list surfaces |
| CLI runbook lane | copyrot batch-2 pushed, PR pending; T4b blocked on muse quota (resets tomorrow AM) | copyrot PRs, T4b resume | none — `.wt/CLINE-*` untouched |

Base pins at audit: anchor-suite `origin/main` = `0c8c2da69b23` (clean, no quorum worktree);
site `origin/main` = `0f95fe561494` — the SAME HEAD the T4a report measured at, so Unit C's
defect evidence (art-167/art-219) is current against main. No `.wt/` name collisions
(grep QUORUM/SELDISC/VALUE-PARITY = 0). `scripts/checkoff.mjs` present.
anchor-suite PR #53 (MCP initialize) touches `src/worker.mjs` MCP section; Unit A touches
the binding-verify section — disjoint sections, branch off main, note in PR body.

## The brief

**Read first:** `AGENTS.md` → `CLAUDE.md` → `board/STANDING-ORDERS.md`. On boot: `tail`
`board/channel/ORCH-STATUS.jsonl` + `board/channel/OPUS-TO-ORCH.md`, re-confirm no new
claims, then claim by `queued/` → `claimed/` move + owner line, and append an
`[OPUS->ORCH-n]` line: dry-run session, worktree builds, pushed branches, PRs HELD,
nothing merged, rows claimed. Explicit-pathspec commits only. Never merge. Never touch
`main`, merge queues, or other lanes' worktrees. Never `git stash` under `.wt/`
(STASH-GUARD). Ignore `.claude/settings.json` (modified by another session — leave it).

**Unit A — `ANCH-QUORUM-LIFECYCLE-1` (timebox 23:25–01:30).** anchor-suite: fetch,
`git worktree add .wt/ANCH-QUORUM-LIFECYCLE-1` off `origin/main` (`0c8c2da69b23`), branch
same name. Build the row as written: adjudicate k vs the site's 2-of-12 posture (read the
site quorum rationale + seasalp pin memory first) → gate `ok` on witness quorum, distinct
zero-witness `log-only` verdict → pending-binding lifecycle closed on all three surfaces
(GET-only upgrade, never re-stamp) → c2sp-tlog-proof-v1 in `verify_anchor_binding` +
verify-runner → two stale comments fixed → vectors + tests green. Deliverable: pushed
branch + PR titled with the row name, body opening **`HOLD — dry-run, do not merge`**,
containing (a) per-defect change list ANCH-1/2/3/4, (b) verification recipe — exact
test/vector commands + expected outputs a reviewer runs verbatim, (c) quorum adjudication
in three sentences, (d) note on PR #53 section-disjointness. Park cleanly at 01:30
(branch pushed, state note in the claimed row, park line in the channel) if not green.

**Unit B (stretch — only if A pushed by ~01:05) — `SELDISC-CORE-SPEC-1`.** Workspace-root
authorship only: write `SELDISC-CORE-BUILD-SPEC.md` at workspace root (⛔ never inside
`repo/`), opening with the adjudication section arguing why the 2026-08-10 REJECT
(`research/SPEC-DISCLOSURE-QUESTION-1-salted-merkle-2026-08-10.md`) does not bind the
export layer; RFC 9901 text sha256-pinned. **Park at persona-pass (robert/phil); stage
zero build rows** — a parked spec is a good outcome. Commit to workspace repo by pathspec.

**Unit C (optional — only if A AND B resolve with ≥25 min left) — T4a value-parity dry-run
branches, site repo:** `VALUE-PARITY-FIX-167-1` (art-167 page ANNEX_I vs kernel
COMMODITY_MAP, evidence `research/PARITY-T4A-VALUE-2026-09-09.md` §5 S6) and/or
`VALUE-PARITY-FIX-219-1` (art-219 loan-size cutoff, §6 row 5). Each its own `.wt/`
worktree off `origin/main` (`0f95fe561494`), page-only edits (⛔ zero kernel bytes),
held PR + verification recipe (before/after `node scripts/gen-value-parity-pairs.mjs`
counts quoted). Mark PR bodies as built on unadjudicated T4a proposals. ⛔ **art-218 and
art-220 excluded** — REGZ family: REGZ-TABLE-SINGLE-WRITER-2 mid-delivery, REGZ-FIXTURE-YEARS-1
is the GLM lane's next dispatch. If pre-push hits the KNOWN pre-existing art-330/331
deeplink red, follow the documented `--no-verify` + CI-backstop precedent (copyrot ledger,
CLI-RUNBOOK-DISPATCH-QUEUE-1) and record it in the PR body — never edit unrelated files.

**⛔ No-go (dry-run does NOT lift these):** the six `claimed/` rows · REGZ-FIXTURE-YEARS-1 /
HELM-MCPB-1 / HELM-OTEL-1 (GLM next) · CONF-PIN-1 / PIN-BATCH-1 (sole-writer registry —
competing unmerged PRs are still conflict debt) · manifest/tools-list/"281-tuple" (Omen) ·
ART220 in any form (§4 CLOSED 22:5x EDT; #1679/#1654 landing order is Tim/ORCH lane) ·
#1828 / merge queues · copyrot/T4 worktrees (`CLINE-*`) · NIGHTLY-RED (Tim-held) · kernel-byte
rows (prove-window machinery) · 8b refill set (DECLARATION-SWEEP-APPLY-2/-3,
WEBMCP-PROPERTYIDMAP-BATCH-1, ART99-CHAIN-CLEANUP-PART2).

**Close-out (01:40 mandatory):** write `research/OPUS-EXTRA-DRYRUN-2026-09-09-RESULTS.md` —
one index of every pushed branch/PR + verification recipe + merge-decision owner (Tim) +
park states + `.wt/` worktrees left behind (Tim runs `worktree remove --force` himself;
sessions are categorically denied it). Checkoff or park rows via `scripts/checkoff.mjs`;
final `[OPUS->ORCH-n]` channel line; **no tool calls after 01:55; terminated at 02:00 EDT
regardless of state.**

**Launch config note (Tim):** start the session with WebFetch/WebSearch pre-allowed —
Unit B's RFC 9901 pin and Unit C's verification need egress; the 09-08 "host TLS loss"
was a permission-classifier artifact, fetches work.

## Kickoff (one sentence)

*Read `C:/dev/Claude/Projects/AINumbers/research/OPUS-EXTRA-DRYRUN-TASKING-2026-09-09.md` and execute it exactly — dry-run discipline: worktree builds, pushed branches, PRs marked HOLD, nothing merged, nothing labelled, both named rows claimed via board mechanics and announced in `board/channel/OPUS-TO-ORCH.md`, hard stop 02:00 EDT with the results doc written regardless of state.*

# Cline Dispatch Queue — free-quota counter-verification tasks

Created 2026-09-09. Five audit task briefs for dispatch to the Cline VS Code extension
(model `cline-free/muse-spark-1.3-contributor`), using its free quota for independent
counter-verification of load-bearing claims that our own corpus never challenged.

Origin: claims-audit sweep of `research/` on 2026-09-09 (four parallel readers over the
WebMCP cluster, the audit/red-team corpus, the state docs, and the estate-correctness
reports). Claims that already survived independent re-derivation (MCP 644-node census,
whitepaper falsifiable counts, art-283 roundtrip) are deliberately NOT re-tasked.

## Why Cline is the right instrument

- Different model lineage than the workspace agents that produced the original claims.
- Real flagged Chrome + terminal on the same machine — can live-probe ainumbers.co,
  run node scripts, and fetch external sources (the internal mcp-probe harness cannot
  check site-copy or external claims at all).
- Sessions are single-task sized; briefs below are scoped to fit one session each
  (T2 may split into two).

## Dispatch protocol (every task)

1. **Independence:** the dispatcher pastes the brief verbatim as the task. Cline must
   derive from primary sources BEFORE reading the challenged report, then compare and
   adjudicate. Every verdict carries an evidence class: `probe-proven` / `derived` /
   `assertion`.
2. **House style:** quote file:line or exact hashes; RED-then-GREEN where a defect is
   reproduced then resolved; no number without a reproduction command.
3. **Scope guard:** audit only. Deliverable = one report file in `research/` plus at
   most two raw-artifact files (JSON/logs) alongside. Zero edits to `repo/`, `board/`,
   or any other surface. Defects found become PROPOSED board rows in the report, not
   direct fixes.
4. **Paths:** Cline's workspace is `C:\Users\Disco\cline\data\workspaces\chat` — all
   briefs use absolute paths into `C:\dev\Claude\Projects\AINumbers\`.
5. **Auto-approve:** Edit auto-approve is OFF (Tim, 2026-09-09). Commands + Read stay
   on so probe scripts can run. If the agent attempts any edit outside its scratch
   space, deny it and note the attempt in the report.

## Queue

| ID | Brief | Target | Status |
|----|-------|--------|--------|
| T1 | `CLINE-T1-WRAPPER-PARSE-COUNTERVERIFY-TASKING-2026-09-09.md` | wrapper-parse 3/462 split (self-verified) | DISPATCHED 2026-09-09 |
| T2 | `CLINE-T2-DOORWAY-CENSUS-REPRO-TASKING-2026-09-09.md` | 89/96 demo-exclusion census (single-agent) | PROPOSED |
| T3 | `CLINE-T3-ESTATE-COUNTS-RECONCILE-TASKING-2026-09-09.md` | conflicting estate counts (697/535/96/…) | REPORTED 2026-09-09 → `research/ESTATE-COUNTS-RECONCILE-2026-09-09.md` + `estate-counts-raw-2026-09-09.json` |
| T4 | `CLINE-T4-PARITY-INSTRUMENTS-COUNTERVERIFY-TASKING-2026-09-09.md` | value-parity 26 Tier-1 + surface-parity 171 divergent | PROPOSED |
| T5 | `CLINE-T5-EXTERNAL-CLAIMS-VERIFY-TASKING-2026-09-09.md` | never-fetched external/site claims | REPORTED 2026-09-09 → `research/EXTERNAL-CLAIMS-VERIFY-2026-09-09.md` + `EXTERNAL-CLAIMS-FETCH-LOG-2026-09-09.md` |

Suggested order: T3 (light, produces the count baseline other tasks cite) → T5 → T1
→ T4 → T2 (heaviest).

Update the Status column as rows move PROPOSED → DISPATCHED → REPORTED → ADJUDICATED.
Adjudication of each report back into the board remains an ORCH call, not Cline's.

## Git note

The workspace root is a deny-by-default evidence repo (`.gitignore` EVIDENCE-GITIGNORE-1):
`*` is ignored, tracked files stay tracked, and new evidence lands via
`git add -f Cline/` — the same path the 2026-09-09 WRAPPER-PARSE report commit used.
New files in this folder will not show in `git status` until force-added.

## Dispatch mechanics (empirical, 2026-09-09 — for the orchestrator's next runs)

1. Cline task/session records: `C:\Users\Disco\.cline\data\sessions\<id>\<id>.json`
   (status: running / pending / idle / completed / failed) and `<id>.messages.json`
   (array `messages`; a trailing assistant `tool_use` with no `tool_result` = blocked
   on approval). Monitor from disk; touch the UI only for approvals.
2. Dispatch recipe that works: panel "+" (new task, ≈(741,25) raster) → a11y
   `set_value` the draft into the message field → click INTO the textarea (~(400,630))
   for real keyboard focus → press **Enter**. Enter does nothing without the real-focus
   click first.
3. Mode chip geometry (raster px, 1280x696 app-state space): Plan ≈(771,669),
   Act ≈(787,669), send triangle ≈(789,654). a11y AXPress on the Act element does
   nothing; use raw event clicks. Ctrl+Shift+A is captured by the Azure extension —
   do not use it.
4. With Edit auto-approve OFF, every file write needs a UI Save click (Save ≈
   element [78] in the approval card). Cline's `editor` tool rejects single writes
   over ~4 KB ("Editor input too large") — instruct chunked writes (~3.5 KB with
   `<!--P2-->`-style continuation markers); approve each chunk.
5. Dispatch briefs by absolute path (`C:\dev\Claude\Projects\AINumbers\Cline\…`);
   outside-workspace writes to `research/` succeed once approved.

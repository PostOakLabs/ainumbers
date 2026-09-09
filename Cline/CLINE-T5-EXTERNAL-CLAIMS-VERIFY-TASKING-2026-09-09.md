# CLINE-T5 — External-claims fetch audit (the structural blind spot)

- **Status:** PROPOSED · 2026-09-09 · dispatcher: ZCode/GLM sweep · executor: Cline
- **Deliverable:** `C:\dev\Claude\Projects\AINumbers\research\EXTERNAL-CLAIMS-VERIFY-2026-09-09.md` (+ raw fetch log)
- **Scope guard:** report only. Fetches and reads are free; no edits to `repo/`,
  `board/`, or site sources; no public submissions of any kind.

## Why this task exists

The estate's own probe harness structurally cannot check site-copy or external-world
claims — the workspace's audits admit this blind spot. Every item below has been
flagged somewhere in `research/` and then left unverified because no instrument could
fetch it. Cline's browser can. Settle each with a per-claim verdict:
**CORROBORATED / CONTRADICTED / UNFINDABLE**, with quoted source text, URL, and fetch
timestamp.

## Claim set

1. **Whitepaper proving-fleet numbers.** "281 receipts cumulative on one consumer GPU
   (RTX 3080); the initial 184-receipt backfill took about five and a half hours" —
   flagged UNSUPPORTED (`research/WHITEPAPER-CLAIMS-AUDIT-2026-09-02.md:141-143,205`;
   RTX 3080 itself is corroborated in `board/done/BANK-PROVE-{1,2,3}.md`). Task: sweep
   the ~2,643 `board/done/` rows and repo surfaces for any record backing 281 / 184 /
   5.5h. Locate the provenance, or recommend the sentence be corrected.
2. **art-220 late-fee amounts.** Page says $30/$41; internal records say $32/$43 —
   Federal Register confirmation outstanding (`research/RECEIPT-REDTEAM-2026-09-02.md:78,98`;
   context in `research/ART220-CARD-PENALTY-RECORD-2026-09-08.md`; the adjacent
   vacatur adjudication blocks PRs #1679/#1654). Task: fetch eCFR 12 C.F.R. §1026.60
   and the Federal Register (incl. the 2025/2026 indexed-amount updates) and settle the
   current lawful late-fee amounts, citing the exact provision text.
3. **GENIUS §4(b) heading.** "disputed between two retrievals and resolves at claim"
   (`research/ADVERSARIAL-SELFAUDIT-2026-09-01.md:281`); locators otherwise verified
   11/11 against PLAW-119publ27 (`research/GENIUS-LOCATOR-VERIFY-2026-09-03.md:24`).
   Task: fetch the Public Law PDF from govinfo and transcribe the §4(b) heading
   verbatim, settling the dispute.
4. **Sister-site claims.** ApexLogics (151 tools) and OmegaCentauri Games (116) —
   tool counts, "receipts on all three" suites, ratification/date claims in the
   whitepaper deployment table and site copy. Board-row pointers:
   `ORCHESTRATOR-BOARD-DONE.md:37,269,501-505`. Task: locate the deployment-table
   claims (grep `repo/chaingraph/standard/` and the site), then fetch both sister
   sites live and verify each externally-checkable claim. Note: a zero from code-search
   is NOT evidence of absence (AL-150 method trap, `ORCHESTRATOR-BOARD-DONE.md:501`) —
   fetch trees/manifests directly.
5. **webmcpdirectory.com "~121 sites."** (`research/WEBMCP-DIRECTORY-DOSSIER-2026-09.md:17`).
   Task: fetch the live directory, count listed sites, verify whether ainumbers.co is
   listed and how, and check the dossier's other directory claims.
6. **Site copy "590 browser tools / 369 chains / 718 MCP tools."** Observed 2026-09-09;
   serving page not yet located. Task: find the page (likely a directory/tile or
   webmcp-adjacent surface), quote it, and check the three numbers against the T3
   baseline (`research/ESTATE-COUNTS-RECONCILE-2026-09-09.md` — run T3 first if it
   exists; otherwise note the dependency).

## Done when

- Every claim has a verdict + quoted evidence + URL + fetch timestamp.
- Item 2 and item 3 end with the exact legal text quoted (these settle standing
  kernel-constant disputes that block PRs).
- Any newly-discovered external claim encountered along the way is listed as
  UNVERIFIED appendix rows for a future task.

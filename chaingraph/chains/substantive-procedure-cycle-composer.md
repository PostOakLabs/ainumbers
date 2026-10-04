# Substantive Procedure Cycle

Four-step substantive audit-recalculation cycle: journal-entry rule screen (weekend/holiday postings, round numbers, suspense accounts, unusual user-account pairs) runs alongside a recalc suite (depreciation, interest accrual, EPS, amortization, prepaid roll-forwards) and a bank/AR confirmation matcher, then terminates in a workpaper bundle composer that assembles a per-area evidence bundle - procedure id, population hash, the three kernels' execution-hash artifacts, an exception list with disposition inputs, and preparer/reviewer/partner sign-off roles. Estimates, going concern, and materiality stay out of scope by design - these kernels are recalculation, rule screens, and matching only. Partner release is single-signer but always recorded review_required per the §27 Human Accountability vocabulary; runtime dual-control gating is not yet wired.

- Page: https://ainumbers.co/chaingraph/chains/substantive-procedure-cycle-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/substantive-procedure-cycle-composer.md

## Workflow chain: Substantive Procedure Cycle

Four-step substantive audit-recalculation cycle: journal-entry rule screen (weekend/holiday postings, round numbers, suspense accounts, unusual user-account pairs) runs alongside a recalc suite (depreciation, interest accrual, EPS, amortization, prepaid roll-forwards) and a bank/AR confirmation matcher, then terminates in a workpaper bundle composer that assembles a per-area evidence bundle - procedure id, population hash, the three kernels' execution-hash artifacts, an exception list with disposition inputs, and preparer/reviewer/partner sign-off roles. Estimates, going concern, and materiality stay out of scope by design - these kernels are recalculation, rule screens, and matching only. Partner release is single-signer but always recorded review_required per the §27 Human Accountability vocabulary; runtime dual-control gating is not yet wired.

Domain: Audit & Assurance

### Steps

1. art-462-je-ruleset-screen
   Screens the journal-entry population for weekend/holiday postings, round numbers, suspense/manual accounts, post-close entries, and unusual user-account pairs; feeds the terminal composer as a kernel_artifacts entry.
2. art-463-recalc-suite
   Recomputes depreciation, interest accrual, EPS, amortization, and prepaid roll-forwards against client figures with a threshold gate; feeds the terminal composer as a kernel_artifacts entry.
3. art-464-confirmation-matcher
   Matches bank/AR confirmation responses against ledger balances (exact and tolerance rules); feeds the terminal composer as a kernel_artifacts entry.
4. art-465-workpaper-bundle-composer
   Composes the per-area evidence bundle from the three kernel artifacts plus the exception list and preparer/reviewer/partner sign-off roles - final stage. GATE: any recorded exception (exception_count > 0) escalates the bundle for reviewer/partner disposition rather than the default zero-exception close.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We re-performed the client recalc suite. Which items still fall outside tolerance before the workpaper goes to review?
Run the AINumbers MCP tool `run_chain` with {"chain":"substantive-procedure-cycle"} and read `art-463-recalc-suite.flagged_count`.
Re-run with `inputs` for `art-463-recalc-suite`, reusing the values that result echoed, with `tolerance` changed so the absolute tolerance is 6000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/substantive-procedure-cycle.html

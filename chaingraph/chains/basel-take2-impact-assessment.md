# Basel Endgame 2026 Reproposal Impact Assessment

Run a bank's own exposure book and business-indicator inputs through the 2026 Basel Endgame reproposal (BCBS/US NPR, reproposed 2026-03-19, comments closed 2026-06-18, final expected ~Q4 2026): credit-risk ERBA/standardized RWA (art-355), operational-risk SMA business-indicator and internal-loss-multiplier component (art-356), and the output-floor phase-in path (art-358) run in parallel off the same book, then a 2023-vs-2026 capital-delta comparator (art-357) reproduces the headline relief story on the caller's own numbers. rule_status stays proposed throughout - every stage carries the reproposal's provisional status and this chain is due for a re-pin WU at finalization (~Q4 2026).

- Page: https://ainumbers.co/chaingraph/chains/basel-take2-impact-assessment.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/basel-take2-impact-assessment.md

## Workflow chain: Basel Endgame 2026 Reproposal Impact Assessment

Run a bank's own exposure book and business-indicator inputs through the 2026 Basel Endgame reproposal (BCBS/US NPR, reproposed 2026-03-19, comments closed 2026-06-18, final expected ~Q4 2026): credit-risk ERBA/standardized RWA (art-355), operational-risk SMA business-indicator and internal-loss-multiplier component (art-356), and the output-floor phase-in path (art-358) run in parallel off the same book, then a 2023-vs-2026 capital-delta comparator (art-357) reproduces the headline relief story on the caller's own numbers. rule_status stays proposed throughout - every stage carries the reproposal's provisional status and this chain is due for a re-pin WU at finalization (~Q4 2026).

Domain: Bank Capital & Credit Risk

### Steps

1. art-355-erba-standardized-rwa-calculator
   Per-exposure risk weights and aggregate RWA under the 2026 reproposal feed both the output-floor simulator (as the standardized-RWA input) and the capital-delta comparator's 2026-side credit-risk figure
2. art-356-compute-oprisk-sma-2026
   Operational-risk capital under the SMA business-indicator component and ILM feeds the capital-delta comparator's 2026-side operational-risk figure
3. art-358-simulate-output-floor
   Year-by-year binding-floor capital-impact path, computed off the same standardized RWA, feeds the capital-delta comparator as the floor-phase-in context for the final delta report
4. art-357-basel-2023-vs-2026-capital-delta-comparator
   RWA and minimum-capital delta versus the 2023 NPR baseline, plus the floor-phase-in path - the caller's own reproduction of the reproposal's headline relief number, with a receipt

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

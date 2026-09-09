# CSDR Penalty Calculation & Exposure

W-A flagship. CSDR cash-penalty calculation incl. the Oct-2025 RTS rate increases (ART-78) -> settlement-efficiency / penalty-cost aggregation (ART-84) -> audit receipt (cry-05). Computes per-fail penalties and forward book exposure. Decision-support draft.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-penalty.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-penalty.md

## Workflow chain: CSDR Penalty Calculation & Exposure

W-A flagship. CSDR cash-penalty calculation incl. the Oct-2025 RTS rate increases (ART-78) -> settlement-efficiency / penalty-cost aggregation (ART-84) -> audit receipt (cry-05). Computes per-fail penalties and forward book exposure. Decision-support draft.

Domain: Settlement Discipline

### Steps

1. art-78-csdr-penalty-calculator
   per-fail + batch penalty (H1) feeds the KPI engine
2. art-84-settlement-efficiency-kpi
   penalty-cost rollup + efficiency score (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite penalty-exposure artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

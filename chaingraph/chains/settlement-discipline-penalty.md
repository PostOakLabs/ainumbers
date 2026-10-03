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

### Ask your agent

Question: An equity fail has run three days at reference price 100. What running penalty does the CSDR rate table price against it?
Run the AINumbers MCP tool `run_chain` with {"chain":"settlement-discipline-penalty"} and read `art-78-csdr-penalty-calculator.penalty_amount`.
Re-run with `inputs` for `art-78-csdr-penalty-calculator`, reusing the values that result echoed, with `fail` changed so one equity fail at reference price 100, three days old. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/settlement-discipline-penalty.html

# CSDR Penalty Recompute (Reference-Price Reachable)

CSDR cash-penalty recompute using a caller-supplied reference price (ART-543) -> settlement-efficiency / penalty-cost aggregation (ART-84) -> audit receipt (cry-05). Fixes the reachability defect in the original settlement-discipline-penalty chain, whose ART-78 stage has no path for a caller to supply a reference price differing from notional. Decision-support draft.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-penalty-v2.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-penalty-v2.md

## Workflow chain: CSDR Penalty Recompute (Reference-Price Reachable)

CSDR cash-penalty recompute using a caller-supplied reference price (ART-543) -> settlement-efficiency / penalty-cost aggregation (ART-84) -> audit receipt (cry-05). Fixes the reachability defect in the original settlement-discipline-penalty chain, whose ART-78 stage has no path for a caller to supply a reference price differing from notional. Decision-support draft.

Domain: Settlement Discipline

### Steps

1. art-543-csdr-penalty-recompute
   per-fail penalty and forward exposure (H1), priced off a caller-supplied reference_price, feeds the KPI engine
2. art-84-settlement-efficiency-kpi
   penalty-cost rollup + efficiency score (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite penalty-exposure artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

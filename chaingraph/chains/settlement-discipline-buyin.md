# Mandatory Buy-In Exposure

CSDR penalty accrual (ART-78) -> last-resort mandatory buy-in exposure/cost modeling under reformed CSDR Refit rules (ART-83) -> audit receipt (cry-05). Models the tail cost of persistent fails.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-buyin.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-buyin.md

## Workflow chain: Mandatory Buy-In Exposure

CSDR penalty accrual (ART-78) -> last-resort mandatory buy-in exposure/cost modeling under reformed CSDR Refit rules (ART-83) -> audit receipt (cry-05). Models the tail cost of persistent fails.

Domain: Settlement Discipline

### Steps

1. art-78-csdr-penalty-calculator
   accrued penalty to trigger (H1) feeds the buy-in modeler
2. art-83-buy-in-exposure-modeler
   buy-in exposure (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite buy-in artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

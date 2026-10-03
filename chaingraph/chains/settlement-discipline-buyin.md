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

### Ask your agent

Question: If the Refit buy-in regime applied tomorrow, what would one aged equity fail cost us under the markup model?
Run the AINumbers MCP tool `run_chain` with {"chain":"settlement-discipline-buyin"} and read `art-83-buy-in-exposure-modeler.total_buyin_exposure`.
Re-run with `inputs` for `art-83-buy-in-exposure-modeler`, reusing the values that result echoed, with `fails` changed so one liquid equity fail of 50,000 shares at reference price 100, aged 60 days. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/settlement-discipline-buyin.html

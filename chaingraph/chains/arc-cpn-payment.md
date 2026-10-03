# Arc CPN Payment

W-A chain. Model CPN corridor economics vs SWIFT/ACH/card for cross-border USD flows.

- Page: https://ainumbers.co/chaingraph/chains/arc-cpn-payment.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-cpn-payment.md

## Workflow chain: Arc CPN Payment

W-A chain. Model CPN corridor economics vs SWIFT/ACH/card for cross-border USD flows.

Domain: Digital-Asset Rails

### Steps

1. art-42-arc-fit-diagnostic
   arc_score → CPN dimension primary
2. art-43-arc-cpn-model
   npv_3yr, cost_per_payment, migration_verdict - CPN corridor economics - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Finance wants the corridor's per-payment cost before we commit. What happens to the migration call once the network's per-transaction fee sits at five hundred dollars?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-cpn-payment"} and read `art-43-arc-cpn-model.verdict`.
Re-run with `inputs` for `art-43-arc-cpn-model`, reusing the values that result echoed, with `cpn_fee_usd` set to 500. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-cpn-payment.html

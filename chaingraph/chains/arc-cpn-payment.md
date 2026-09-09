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

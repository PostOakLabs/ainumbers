# Broker-Dealer Operations Pack

15c3-3 Exhibit A customer reserve formula > TRACE/CAT reporting lint.

- Page: https://ainumbers.co/chaingraph/chains/broker-dealer-ops-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/broker-dealer-ops-pack.md

## Workflow chain: Broker-Dealer Operations Pack

15c3-3 Exhibit A customer reserve formula > TRACE/CAT reporting lint.

Domain: Securities Settlement

### Steps

1. art-396-compute-15c3-3-reserve
   reserve_requirement_musd and deposit_sufficient feed the reporting-period context for Stage 2 TRACE/CAT lint
2. art-397-lint-trace-cat-reports
   Reports TRACE timeliness and CAT structural lint verdicts for the same reporting period - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

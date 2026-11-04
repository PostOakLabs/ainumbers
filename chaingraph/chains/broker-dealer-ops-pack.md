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

### Ask your agent

Question: Is the cash on deposit in the special reserve account enough to cover today's Rule 15c3-3 customer reserve requirement?
Run the AINumbers MCP tool `run_chain` with {"chain":"broker-dealer-ops-pack"} and read `art-396-compute-15c3-3-reserve.deposit_sufficient`.
Re-run with `inputs` for `art-396-compute-15c3-3-reserve`, reusing the values that result echoed, with `reserve_account_balance_musd` set to 30. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/broker-dealer-ops-pack.html

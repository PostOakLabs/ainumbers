# Canton Capital Efficiency Chain

Assess Canton pilot readiness and compute settlement-risk capital savings.

- Page: https://ainumbers.co/chaingraph/chains/canton-capital-efficiency.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-capital-efficiency.md

## Workflow chain: Canton Capital Efficiency Chain

Assess Canton pilot readiness and compute settlement-risk capital savings.

Domain: Digital-Asset Rails

### Steps

1. 503-canton-tokenization-readiness-diagnostic
   entity_type,grade,gaps feed Stage 2 capital optimizer
2. 504-settlement-risk-capital-optimizer
   total_rwa_delta,annual_saving_bps feeds downstream Basel 3.1/XVA/LCR chain - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Would moving this swap book to same-day Canton settlement free enough capital to be worth the migration?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-capital-efficiency"} and read `504-settlement-risk-capital-optimizer.verdict`.
Re-run with `inputs` for `504-settlement-risk-capital-optimizer`, reusing the values that result echoed, with `positions` changed so the one position has rating unrated, settlement_type bilateral_repo and notional_usd 100000000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-capital-efficiency.html

# Wholesale Tokenized Settlement Fit Diagnostic

Single-node D0 diagnostic grading a firm/desk A-F across settlement asset, finality regime, cross-network atomicity, asset-leg type, cash-leg issuer, intraday liquidity, and controls for wholesale tokenized settlement; routes to the right wholesale-settlement chain.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-fit.md

## Workflow chain: Wholesale Tokenized Settlement Fit Diagnostic

Single-node D0 diagnostic grading a firm/desk A-F across settlement asset, finality regime, cross-network atomicity, asset-leg type, cash-leg issuer, intraday liquidity, and controls for wholesale tokenized settlement; routes to the right wholesale-settlement chain.

Domain: Wholesale Settlement

### Steps

1. art-56-tokenized-settlement-fit-diagnostic
   dim_scores and primary_recommendation route to wholesale-settlement-cross-network-dvp / wholesale-settlement-deposit-token / wholesale-settlement-settlement-asset / wholesale-settlement-collateral-mobility / wholesale-settlement-intraday-liquidity / wholesale-settlement-participant-onboarding / wholesale-settlement-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before we commit to a tokenized settlement network, which readiness gap should this year budget close first?
Run the AINumbers MCP tool `run_chain` with {"chain":"wholesale-settlement-fit"} and read `art-56-tokenized-settlement-fit-diagnostic.primary_recommendation`.
Re-run with `inputs` for `art-56-tokenized-settlement-fit-diagnostic`, reusing the values that result echoed, with `intraday_liquidity` set to "prefunded". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-fit.html

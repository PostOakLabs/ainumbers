# Canton Margin Call & Collateral Mobilization Chain

Margin computation (UMR/d499 for derivatives; GMRA/d349 for repo/SFT), collateral eligibility, and cash-leg finality.

- Page: https://ainumbers.co/chaingraph/chains/canton-margin-call.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-margin-call.md

## Workflow chain: Canton Margin Call & Collateral Mobilization Chain

Margin computation (UMR/d499 for derivatives; GMRA/d349 for repo/SFT), collateral eligibility, and cash-leg finality.

Domain: Digital-Asset Rails

### Steps

1. 513-margin-call-collateral-mobilizer
   branch,margin_required,collateral_gap feed Stage 2 collateral eligibility
2. 505-tokenized-collateral-eligibility-checker
   hqla_tier,eligible_value feed Stage 3 cash-leg finality
3. 506-onchain-cash-leg-finality-checker
   finality_verdict - Exports margin call collateral mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Can we meet today's initial and variation margin call from the collateral we hold, or is there a shortfall?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-margin-call"} and read `513-margin-call-collateral-mobilizer.shortfall`.
Re-run with `inputs` for `513-margin-call-collateral-mobilizer`, reusing the values that result echoed, with `collateral_rows` changed so the one collateral row has notional 100000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-margin-call.html

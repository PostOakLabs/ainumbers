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

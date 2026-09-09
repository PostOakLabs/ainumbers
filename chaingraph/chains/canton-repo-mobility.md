# Canton Repo Collateral Mobility Chain

Compute repo haircut with Canton 24/7 valuation, verify collateral and cash-leg finality.

- Page: https://ainumbers.co/chaingraph/chains/canton-repo-mobility.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-repo-mobility.md

## Workflow chain: Canton Repo Collateral Mobility Chain

Compute repo haircut with Canton 24/7 valuation, verify collateral and cash-leg finality.

Domain: Digital-Asset Rails

### Steps

1. 508-repo-haircut-collateral-calculator
   total_haircut_pct,initial_margin,canton_247 feed Stage 2 collateral eligibility
2. 505-tokenized-collateral-eligibility-checker
   hqla_tier,dtc_eligible feed Stage 3 cash-leg finality
3. 506-onchain-cash-leg-finality-checker
   finality_verdict,genius_status - Exports repo collateral mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

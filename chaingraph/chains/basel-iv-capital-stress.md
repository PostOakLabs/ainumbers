# Basel IV Capital Stress Testing

Basel RWA calculation > credit stress-testing workbench > RAROC loan pricing > IFRS9 credit migration matrix: composite Basel IV capital stress mandate.

- Page: https://ainumbers.co/chaingraph/chains/basel-iv-capital-stress.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/basel-iv-capital-stress.md

## Workflow chain: Basel IV Capital Stress Testing

Basel RWA calculation > credit stress-testing workbench > RAROC loan pricing > IFRS9 credit migration matrix: composite Basel IV capital stress mandate.

Domain: Bank Capital & Credit Risk

### Steps

1. 201-basel-rwa-calculator
   rwa_baseline and capital_ratio feed Stage 2 credit stress-testing workbench
2. 202-credit-stress-testing-workbench
   stress_scenarios and loss_estimates feed Stage 3 RAROC loan pricing model
3. 203-raroc-loan-pricing-model
   raroc_hurdle and loan_pricing_matrix feed Stage 4 IFRS9 credit migration
4. 204-ifrs9-credit-migration-matrix
   migration_matrix and ecl_projection - final Basel IV capital stress mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

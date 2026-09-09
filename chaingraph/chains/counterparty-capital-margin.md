# Counterparty Capital & Margin

SA-CCR exposure calculation > CVA capital framework selection > SA-IM initial margin calculation > CVA calculator: composite counterparty capital and margin mandate.

- Page: https://ainumbers.co/chaingraph/chains/counterparty-capital-margin.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/counterparty-capital-margin.md

## Workflow chain: Counterparty Capital & Margin

SA-CCR exposure calculation > CVA capital framework selection > SA-IM initial margin calculation > CVA calculator: composite counterparty capital and margin mandate.

Domain: Bank Capital & Credit Risk

### Steps

1. 400-sa-ccr-exposure-calculator
   sa_ccr_ead and exposure_by_asset_class feed Stage 2 CVA capital framework selection
2. 401-cva-capital-framework-selector
   cva_framework and capital_charge feed Stage 3 SA-IM margin calculation
3. 516-sa-im-initial-margin-calculator
   im_requirement and collateral_plan feed Stage 4 CVA calculator
4. 200-cva-calculator
   cva_fair_value and composite_counterparty_mandate - final counterparty capital mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# US Treasury Clearing Chain

Model clearing access economics → estimate FICC margin netting benefit → calculate repo haircut and collateral eligibility → estimate cross-margining benefit → mobilize margin call collateral and verify tokenized collateral eligibility. End-to-end US Treasury clearing and SEC Rule 17ad-22 journey.

- Page: https://ainumbers.co/chaingraph/chains/us-treasury-clearing.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/us-treasury-clearing.md

## Workflow chain: US Treasury Clearing Chain

Model clearing access economics → estimate FICC margin netting benefit → calculate repo haircut and collateral eligibility → estimate cross-margining benefit → mobilize margin call collateral and verify tokenized collateral eligibility. End-to-end US Treasury clearing and SEC Rule 17ad-22 journey.

Domain: Treasury Clearing

### Steps

1. art-49-clearing-access-model-selector
   clearing_model,cost_basis,margin_requirements feed Stage 2 FICC netting
2. art-50-ficc-margin-netting-estimator
   initial_margin_netting_benefit,net_im_usd,portfolio_offset feed Stage 3 repo haircut
3. 508-repo-haircut-collateral-calculator
   haircut_pct,collateral_value,eligible_assets,dtc_eligible feed Stage 4 cross-margin benefit
4. art-51-cross-margining-benefit-estimator
   cross_margin_savings_usd,portfolio_offset_pct,netting_set feed Stage 5 collateral mobilization
5. 513-margin-call-collateral-mobilizer
   mobilization_plan,eligible_pool,shortfall_flag feed Stage 5 tokenized eligibility
6. 505-tokenized-collateral-eligibility-checker
   eligibility_verdict,dtc_clearable,hqla_tier - Exports US treasury clearing mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

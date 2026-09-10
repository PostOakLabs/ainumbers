# US Wealth & Advisory - Reg BI Suitability

Model portfolio risk > Reg BI best-interest check > portfolio construction/rebalancing > costs & fee disclosure > Form CRS.

- Page: https://ainumbers.co/chaingraph/chains/wealth-advisory-regbi.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wealth-advisory-regbi.md

## Workflow chain: US Wealth & Advisory - Reg BI Suitability

Model portfolio risk > Reg BI best-interest check > portfolio construction/rebalancing > costs & fee disclosure > Form CRS.

Domain: Consumer & Wealth Compliance

### Steps

1. 429-model-portfolio-risk-analytics
   risk_profile and model_allocation feed Stage 2 Reg BI best-interest check
2. 463-reg-bi-best-interest-checker
   reg_bi_verdict and obligation_gaps feed Stage 3 portfolio construction
3. 432-portfolio-drift-rebalancing
   rebalancing_trades and cost_estimates feed Stage 4 costs disclosure
4. 428-mifid-costs-charges-calculator
   total_cost_bps and riy feed Stage 5 Form CRS
5. 464-form-crs-generator
   Exports composite Reg BI suitability Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

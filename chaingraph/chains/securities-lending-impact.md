# Securities Lending Settlement Impact

Recall/revenue impact modelling > non-DVP retail fund settlement impact > US/EU settlement mismatch impact: composite securities-lending settlement mandate.

- Page: https://ainumbers.co/chaingraph/chains/securities-lending-impact.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/securities-lending-impact.md

## Workflow chain: Securities Lending Settlement Impact

Recall/revenue impact modelling > non-DVP retail fund settlement impact > US/EU settlement mismatch impact: composite securities-lending settlement mandate.

Domain: Securities Settlement

### Steps

1. 371-securities-lending-recall-revenue-impact-modeler
   recall_revenue_impact and haircut_effect feed Stage 2 retail fund settlement impact
2. 373-non-dvp-retail-fund-settlement-impact-assessor
   non_dvp_impact and fund_liquidity_risk feed Stage 3 US/EU mismatch analysis
3. 378-us-eu-settlement-mismatch-impact-estimator
   mismatch_exposure and cross-border_settlement_cost - final securities-lending mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

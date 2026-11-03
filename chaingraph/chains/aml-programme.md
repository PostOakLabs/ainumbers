# AML Programme

Customer risk rating > TM rule building > CTR/SAR thresholds > AML Policy Mandate. Full receipted run available in the composer.

- Page: https://ainumbers.co/chaingraph/chains/aml-programme.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/aml-programme.md

## Workflow chain: AML Programme

Customer risk rating > TM rule building > CTR/SAR thresholds > AML Policy Mandate. Full receipted run available in the composer.

Domain: Financial Crime & KYC

### Steps

1. 110-customer-risk-rating
   risk_tier and composite_score feed Stage 2 TM rule calibration
2. 116-tm-rule-builder
   rule_set and velocity_thresholds feed Stage 3 CTR/SAR simulation
3. 119-ctr-sar-threshold-simulator
   threshold_values and alert_triggers feed Stage 4 mandate payload
4. 131-ap2-aml-mandate-builder
   Exports composite AML Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

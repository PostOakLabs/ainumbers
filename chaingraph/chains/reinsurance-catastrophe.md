# Reinsurance & Catastrophe Risk

Reinsurance burning-cost pricing > parametric trigger design > cyber accumulation modelling > P&C combined-ratio analysis: composite reinsurance risk mandate.

- Page: https://ainumbers.co/chaingraph/chains/reinsurance-catastrophe.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/reinsurance-catastrophe.md

## Workflow chain: Reinsurance & Catastrophe Risk

Reinsurance burning-cost pricing > parametric trigger design > cyber accumulation modelling > P&C combined-ratio analysis: composite reinsurance risk mandate.

Domain: Insurance & Reinsurance

### Steps

1. 456-reinsurance-burning-cost-pricer
   burning_cost_price and loss_load feed Stage 2 parametric trigger design
2. 458-parametric-trigger-designer
   parametric_terms and trigger_calibration feed Stage 3 cyber accumulation model
3. 461-cyber-insurance-accumulation-modeler
   cyber_accumulation_limits and correlation feed Stage 4 P&C combined-ratio analysis
4. 455-pc-combined-ratio-analyzer
   combined_ratio and reinsurance_adequacy - final reinsurance risk mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

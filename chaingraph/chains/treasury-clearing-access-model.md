# Treasury Clearing Access Model Selector

W-A. Access-model selection & economics (ART-49) -> SA-CCR/QCCP capital impact (504) -> FICC VaR-margin & netting estimate (ART-50). The flagship decision chain.

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-access-model.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-access-model.md

## Workflow chain: Treasury Clearing Access Model Selector

W-A. Access-model selection & economics (ART-49) -> SA-CCR/QCCP capital impact (504) -> FICC VaR-margin & netting estimate (ART-50). The flagship decision chain.

Domain: Treasury Clearing

### Steps

1. art-49-clearing-access-model-selector
   recommended_model + im_estimate_by_model feed the capital optimizer
2. 504-settlement-risk-capital-optimizer
   rwa_delta + qccp_capital feed the margin/netting estimate
3. art-50-ficc-margin-netting-estimator
   Exports the composite access-model decision - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

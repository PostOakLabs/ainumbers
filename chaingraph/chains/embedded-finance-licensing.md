# Embedded Finance Licensing

Seller onboarding classification > MTL licensing risk mapping > fintech compliance control mapping > sponsor-bank readiness scoring: composite embedded finance licensing mandate.

- Page: https://ainumbers.co/chaingraph/chains/embedded-finance-licensing.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/embedded-finance-licensing.md

## Workflow chain: Embedded Finance Licensing

Seller onboarding classification > MTL licensing risk mapping > fintech compliance control mapping > sponsor-bank readiness scoring: composite embedded finance licensing mandate.

Domain: BaaS & Embedded Finance

### Steps

1. 149-seller-onboarding-classifier
   seller_classification and licensing_threshold feed Stage 2 MTL licensing risk mapping
2. 150-mtl-licensing-risk-mapper
   mtl_risk_score and state_by_state_requirements feed Stage 3 compliance control mapping
3. 158-fintech-compliance-control-mapper
   compliance_controls and gap_assessment feed Stage 4 sponsor-bank readiness scoring
4. 162-sponsor-bank-readiness-scorer
   sponsor_bank_readiness and composite_licensing_mandate - final embedded finance mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

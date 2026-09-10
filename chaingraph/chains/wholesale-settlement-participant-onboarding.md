# Cross-Network Settlement Participant Onboarding

W-F. Participant allowlist (LEI/sanctions/eligibility, 509) -> participant risk rating (customer_risk_rating) -> AML typology score (art-10). KYC/sanctions/AML pack for a wholesale tokenized-settlement participant across the cash and asset networks.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-participant-onboarding.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-participant-onboarding.md

## Workflow chain: Cross-Network Settlement Participant Onboarding

W-F. Participant allowlist (LEI/sanctions/eligibility, 509) -> participant risk rating (customer_risk_rating) -> AML typology score (art-10). KYC/sanctions/AML pack for a wholesale tokenized-settlement participant across the cash and asset networks.

Domain: Wholesale Settlement

### Steps

1. 509-canton-party-allowlist-validator
   party verdict and sanctions flags (H1) feed the risk rater
2. 110-customer-risk-rating
   risk rating (H2) feeds the typology scorer
3. art-10-amla-transaction-typology-risk-scorer
   Exports composite participant-onboarding artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Trade Counterparty Screening & AML

W-D. Party allowlist (LEI/OFAC/sanctions/FATF Rec 16, 509) -> counterparty risk rating (customer_risk_rating) -> TBML typology score (art-10). KYC/sanctions/AML pack for a trade counterparty.

- Page: https://ainumbers.co/chaingraph/chains/digital-trade-counterparty-aml.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/digital-trade-counterparty-aml.md

## Workflow chain: Trade Counterparty Screening & AML

W-D. Party allowlist (LEI/OFAC/sanctions/FATF Rec 16, 509) -> counterparty risk rating (customer_risk_rating) -> TBML typology score (art-10). KYC/sanctions/AML pack for a trade counterparty.

Domain: Digital Trade

### Steps

1. 509-canton-party-allowlist-validator
   party verdict and sanctions flags (H1) feed the risk rater
2. 110-customer-risk-rating
   risk rating (H2) feeds the typology scorer
3. art-10-amla-transaction-typology-risk-scorer
   Exports composite counterparty-AML artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

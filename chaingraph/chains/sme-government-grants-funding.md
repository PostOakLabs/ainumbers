# SME Government Grants & Funding

Government funding and grant mapping > SME credit risk scoring > revenue-based finance calculation: composite SME government grants and funding mandate.

- Page: https://ainumbers.co/chaingraph/chains/sme-government-grants-funding.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sme-government-grants-funding.md

## Workflow chain: SME Government Grants & Funding

Government funding and grant mapping > SME credit risk scoring > revenue-based finance calculation: composite SME government grants and funding mandate.

Domain: SME & Commercial Finance

### Steps

1. 245-government-funding-grant-mapper
   grant_eligibility and funding_sources feed Stage 2 SME credit risk scoring
2. 239-sme-credit-risk-scoring
   credit_score and debt_capacity feed Stage 3 revenue-based finance calculator
3. 244-revenue-based-finance-calculator
   rbf_terms and repayment_structure - final SME grants/funding mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

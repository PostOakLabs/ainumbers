# SME Finance & Lending

SME credit risk scoring > working capital gap analysis > invoice finance eligibility > revenue-based finance calculator > lending covenant monitoring: composite SME finance mandate.

- Page: https://ainumbers.co/chaingraph/chains/sme-finance-lending.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sme-finance-lending.md

## Workflow chain: SME Finance & Lending

SME credit risk scoring > working capital gap analysis > invoice finance eligibility > revenue-based finance calculator > lending covenant monitoring: composite SME finance mandate.

Domain: SME & Commercial Finance

### Steps

1. 239-sme-credit-risk-scoring
   credit_score and risk_tier feed Stage 2 working capital gap analysis
2. 240-working-capital-gap-calculator
   working_capital_gap and cashflow_seasonality feed Stage 3 invoice finance eligibility
3. 242-invoice-finance-eligibility
   invoice_finance_capacity and eligible_receivables feed Stage 4 revenue-based finance
4. 244-revenue-based-finance-calculator
   rbf_terms and repayment_schedule feed Stage 5 lending covenant monitoring
5. 247-lending-covenant-monitoring
   covenant_triggers and monitoring_plan - final SME finance mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

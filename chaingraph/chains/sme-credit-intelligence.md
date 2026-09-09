# SME Credit Intelligence

SME credit risk scoring > working capital gap analysis > business loan readiness > open-finance credit signal mapping > SME cashflow stress test: composite SME credit intelligence mandate.

- Page: https://ainumbers.co/chaingraph/chains/sme-credit-intelligence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sme-credit-intelligence.md

## Workflow chain: SME Credit Intelligence

SME credit risk scoring > working capital gap analysis > business loan readiness > open-finance credit signal mapping > SME cashflow stress test: composite SME credit intelligence mandate.

Domain: SME & Commercial Finance

### Steps

1. 239-sme-credit-risk-scoring
   credit_score and risk_tier feed Stage 2 working capital gap analysis
2. 240-working-capital-gap-calculator
   working_capital_gap and cashflow_gaps feed Stage 3 business loan readiness
3. 241-business-loan-readiness-checker
   loan_readiness_score and qualification_criteria feed Stage 4 open-finance signal mapping
4. 243-open-finance-credit-signal-mapper
   open_finance_signals and alternative_data feed Stage 5 cashflow stress test
5. 246-sme-cashflow-stress-test
   stress_scenario_results and composite_credit_mandate - final SME credit mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

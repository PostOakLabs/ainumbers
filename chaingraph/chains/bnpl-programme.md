# BNPL Programme - FCA Regulation

FCA BNPL readiness > affordability modelling > APR calculation > disclosure templates > arrears & collections policy.

- Page: https://ainumbers.co/chaingraph/chains/bnpl-programme.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/bnpl-programme.md

## Workflow chain: BNPL Programme - FCA Regulation

FCA BNPL readiness > affordability modelling > APR calculation > disclosure templates > arrears & collections policy.

Domain: Consumer & Wealth Compliance

### Steps

1. 187-bnpl-fca-readiness-checker
   readiness_score and gap_list feed Stage 2 affordability model
2. 190-bnpl-affordability-assessment-modeller
   affordability_result and repayment_schedule feed Stage 3 APR calc
3. 193-bnpl-apr-calculator
   representative_apr and total_charge feed Stage 4 disclosure templates
4. 191-bnpl-disclosure-template-generator
   pcci_template and summary_box feed Stage 5 arrears assessment
5. 192-bnpl-arrears-collections-checker
   Exports composite BNPL programme Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

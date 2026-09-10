# PI/EMI Authorisation - PSD2/PSRs

PI authorisation readiness > EMI capital requirements > PI own funds (PSD2 Art.9) > PSP safeguarding assessment > PSR APP reimbursement liability.

- Page: https://ainumbers.co/chaingraph/chains/pi-emi-authorisation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pi-emi-authorisation.md

## Workflow chain: PI/EMI Authorisation - PSD2/PSRs

PI authorisation readiness > EMI capital requirements > PI own funds (PSD2 Art.9) > PSP safeguarding assessment > PSR APP reimbursement liability.

Domain: BaaS & Embedded Finance

### Steps

1. 404-payment-institution-authorisation-readiness-checker
   readiness_gaps and business_volumes feed Stage 2 capital calc
2. 405-emi-capital-requirements-calculator
   emi_capital_requirement and method_results feed Stage 3 own funds
3. 418-pi-own-funds-calculator
   own_funds_requirement feeds Stage 4 safeguarding assessment
4. 269-psp-safeguarding-assessment
   safeguarding_method and shortfall feed Stage 5 APP liability
5. 406-psr-app-reimbursement-liability-splitter
   Exports composite PI/EMI authorisation Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

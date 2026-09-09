# Credit Decisioning

PD/LGD/EAD modelling > Basel RWA calculation > RAROC pricing > covenant compliance check > facility structuring > composite credit mandate.

- Page: https://ainumbers.co/chaingraph/chains/credit-decisioning.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/credit-decisioning.md

## Workflow chain: Credit Decisioning

PD/LGD/EAD modelling > Basel RWA calculation > RAROC pricing > covenant compliance check > facility structuring > composite credit mandate.

Domain: Bank Capital & Credit Risk

### Steps

1. 198-pd-lgd-ead-modeller
   pd, lgd, ead values feed Stage 2 Basel RWA calculation
2. 201-basel-rwa-calculator
   rwa_total and capital_requirement feed Stage 3 RAROC pricing
3. 437-raroc-loan-pricing
   raroc and hurdle_rate feed Stage 4 covenant compliance
4. 199-financial-covenant-compliance-checker
   covenant_status and breach_flags feed Stage 5 facility structuring
5. 435-credit-facility-structuring
   Exports credit decisioning Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

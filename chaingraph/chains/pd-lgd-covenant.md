# PD, LGD, EAD to Covenant Compliance

Credit risk parameter modelling > Basel RWA calculation > financial covenant compliance check.

- Page: https://ainumbers.co/chaingraph/chains/pd-lgd-covenant.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pd-lgd-covenant.md

## Workflow chain: PD, LGD, EAD to Covenant Compliance

Credit risk parameter modelling > Basel RWA calculation > financial covenant compliance check.

Domain: Bank Capital & Credit Risk

### Steps

1. 198-pd-lgd-ead-modeller
   pd, lgd, ead values feed T201 Basel RWA calculation
2. 201-basel-rwa-calculator
   rwa_total and capital_requirement feed T199 covenant compliance
3. 199-financial-covenant-compliance-checker
   Exports credit risk Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

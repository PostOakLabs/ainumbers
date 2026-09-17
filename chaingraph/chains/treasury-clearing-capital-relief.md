# Central Clearing Capital & RWA Relief

W-E. SA-CCR/QCCP capital impact of moving bilateral UST/repo to a CCP (504) -> Basel 3.1 RWA delta & output floor (art-07) -> RWA scenario modeling (sim-03). Bank/dealer capital case for clearing.

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-capital-relief.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-capital-relief.md

## Workflow chain: Central Clearing Capital & RWA Relief

W-E. SA-CCR/QCCP capital impact of moving bilateral UST/repo to a CCP (504) -> Basel 3.1 RWA delta & output floor (art-07) -> RWA scenario modeling (sim-03). Bank/dealer capital case for clearing.

Domain: Treasury Clearing

### Steps

1. 504-settlement-risk-capital-optimizer
   qccp_capital + rwa_delta feed the Basel 3.1 delta calculator
2. art-07-basel31-reporting-delta-calculator
   rwa + output-floor figures feed the RWA scenario modeler
3. sim-03-basel-rwa-scenario-modeler
   Exports composite capital-relief artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Canton Deposit Token Compliance Chain

Classify the digital asset type and validate PvP settlement compliance for Canton deposit tokens. MiCA/MiFID II regulatory classification → multi-currency PvP finality check.

- Page: https://ainumbers.co/chaingraph/chains/canton-deposit-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-deposit-compliance.md

## Workflow chain: Canton Deposit Token Compliance Chain

Classify the digital asset type and validate PvP settlement compliance for Canton deposit tokens. MiCA/MiFID II regulatory classification → multi-currency PvP finality check.

Domain: Digital-Asset Rails

### Steps

1. 510-digital-asset-regulatory-classifier
   mifid_instrument,mca_token_type,dlt_pilot_eligible feed Stage 2 PvP validator
2. 511-multi-currency-pvp-validator
   pvp_verdict,cross_network_finality - Exports deposit compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

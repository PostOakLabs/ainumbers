# Canton Securities Issuance Chain

Regulatory classification and Daml lifecycle validation for tokenized securities.

- Page: https://ainumbers.co/chaingraph/chains/canton-securities-issuance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-securities-issuance.md

## Workflow chain: Canton Securities Issuance Chain

Regulatory classification and Daml lifecycle validation for tokenized securities.

Domain: Digital-Asset Rails

### Steps

1. 510-digital-asset-regulatory-classifier
   frameworks_applied,mifid_instrument,dlt_pilot_eligible feed Stage 2 lifecycle validator
2. 512-tokenized-security-lifecycle-validator
   lifecycle_verdict,daml_gaps - Exports securities issuance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

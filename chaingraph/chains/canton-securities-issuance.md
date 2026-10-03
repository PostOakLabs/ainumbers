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

### Ask your agent

Question: A tokenized note issued on Canton carries an ISIN and a Daml lifecycle. Does the lifecycle validator clear it as compliant?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-securities-issuance"} and read `512-tokenized-security-lifecycle-validator.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-securities-issuance.html

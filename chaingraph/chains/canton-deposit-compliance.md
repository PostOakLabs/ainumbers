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

### Ask your agent

Question: Does this PvP settlement satisfy CPMI-IOSCO Principle 12 as configured, and what happens to the verdict if finality is only provisional?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-deposit-compliance"} and read `511-multi-currency-pvp-validator.verdict`.
Re-run with `inputs` for `511-multi-currency-pvp-validator`, reusing the values that result echoed, with `finality_type` set to "provisional". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-deposit-compliance.html

# TFR Travel-Rule Batch Conformance

Originator/beneficiary field completeness on hashed/synthetic transfer batches incl. unhosted-wallet branch (ART-104) -> Merkle integrity (cry-04). Reuses the shipped synthetic-batch screening pattern; no real PII.

- Page: https://ainumbers.co/chaingraph/chains/mica-travel-rule.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-travel-rule.md

## Workflow chain: TFR Travel-Rule Batch Conformance

Originator/beneficiary field completeness on hashed/synthetic transfer batches incl. unhosted-wallet branch (ART-104) -> Merkle integrity (cry-04). Reuses the shipped synthetic-batch screening pattern; no real PII.

Domain: Digital-Asset Rails

### Steps

1. art-104-tfr-travel-rule-batch-validator
   batch conformance + flagged transfers (H1) feed the verifier
2. cry-04-merkle-batch-verifier
   Exports composite travel-rule artifact with Merkle-root execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: This batch of transfers is ready to relay. Which records would the TFR validator flag before we send it?
Run the AINumbers MCP tool `run_chain` with {"chain":"mica-travel-rule"} and read `art-104-tfr-travel-rule-batch-validator.batch_conformance_pct`.
Re-run with `inputs` for `art-104-tfr-travel-rule-batch-validator`, reusing the values that result echoed, with `inputs` changed so one transfer omits the originator name. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mica-travel-rule.html

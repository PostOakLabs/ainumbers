# Tempo Validator Readiness

ART-41 standalone node. 12-question infrastructure readiness scorer for prospective Tempo validators.

- Page: https://ainumbers.co/chaingraph/chains/tempo-validator-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-validator-readiness.md

## Workflow chain: Tempo Validator Readiness

ART-41 standalone node. 12-question infrastructure readiness scorer for prospective Tempo validators.

Domain: Digital-Asset Rails

### Steps

1. art-41-tempo-validator-readiness
   Exports infrastructure_mandate artifact with execution_hash and permissioning notice - standalone node

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We want to run a Tempo validator. Which requirement is holding our readiness score back from approval?
Run the AINumbers MCP tool `run_chain` with {"chain":"tempo-validator-readiness"} and read `art-41-tempo-validator-readiness.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/tempo-validator-readiness.html

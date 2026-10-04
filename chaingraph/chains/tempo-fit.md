# Tempo Fit Diagnostic

Single-node D0 diagnostic grading an organisation A–F across four Tempo use cases (Issue/TIP-20, Payments rail, Agent/MPP, Commerce/checkout).

- Page: https://ainumbers.co/chaingraph/chains/tempo-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-fit.md

## Workflow chain: Tempo Fit Diagnostic

Single-node D0 diagnostic grading an organisation A–F across four Tempo use cases (Issue/TIP-20, Payments rail, Agent/MPP, Commerce/checkout).

Domain: Digital-Asset Rails

### Steps

1. art-34-tempo-fit-diagnostic
   dim_scores and primary_recommendation route to tempo-payments / tempo-issuance / tempo-mpp-agent / tempo-agentic-checkout chains

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Should our payroll product move to Tempo? Which dimension of the fit diagnostic drives that call?
Run the AINumbers MCP tool `run_chain` with {"chain":"tempo-fit"} and read `art-34-tempo-fit-diagnostic.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/tempo-fit.html

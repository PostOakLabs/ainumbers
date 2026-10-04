# T+1 Settlement Readiness Diagnostic

Single-node D0 diagnostic scoring a firm's readiness for the EU/UK/CH T+1 move (11 Oct 2027) and the Dec-2026 allocation/confirmation timing mandate, routing to the right settlement-discipline chain.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-fit.md

## Workflow chain: T+1 Settlement Readiness Diagnostic

Single-node D0 diagnostic scoring a firm's readiness for the EU/UK/CH T+1 move (11 Oct 2027) and the Dec-2026 allocation/confirmation timing mandate, routing to the right settlement-discipline chain.

Domain: Settlement Discipline

### Steps

1. art-77-t1-settlement-readiness-diagnostic
   readiness grade + gaps route to sd-ssi-hygiene / sd-failpredict / sd-penalty / sd-alloc-affirm / sd-message-conformance / sd-buyin / sd-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Budget covers automating one T+1 workstream this quarter. Which readiness dimension does automating matching alone lift?
Run the AINumbers MCP tool `run_chain` with {"chain":"settlement-discipline-fit"} and read `art-77-t1-settlement-readiness-diagnostic.dim_scores.matching.score`.
Re-run with `inputs` for `art-77-t1-settlement-readiness-diagnostic`, reusing the values that result echoed, with `matching_method` set to "auto". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/settlement-discipline-fit.html

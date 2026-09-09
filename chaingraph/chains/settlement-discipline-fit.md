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

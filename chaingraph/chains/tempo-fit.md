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

# ECCN / Dual-Use Classification

Product attributes -> ECCN (EAR) + EU Annex I + controlling regime + licence logic including 2025 emerging-tech controls (ART-94) -> Merkle integrity (cry-04). EU Annex I updated 15 Nov 2025.

- Page: https://ainumbers.co/chaingraph/chains/export-control-eccn.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/export-control-eccn.md

## Workflow chain: ECCN / Dual-Use Classification

Product attributes -> ECCN (EAR) + EU Annex I + controlling regime + licence logic including 2025 emerging-tech controls (ART-94) -> Merkle integrity (cry-04). EU Annex I updated 15 Nov 2025.

Domain: Export Control

### Steps

1. art-94-eccn-dual-use-classifier
   classification + licence requirement (H1) feed the verifier
2. cry-04-merkle-batch-verifier
   Exports composite classification artifact with Merkle-root execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

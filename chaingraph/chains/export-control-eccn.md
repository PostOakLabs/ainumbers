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

### Ask your agent

Question: Customs is holding our control module pending classification. Which ECCN applies, and does exporting it need a licence?
Run the AINumbers MCP tool `run_chain` with {"chain":"export-control-eccn"} and read `art-94-eccn-dual-use-classifier.eccn`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/export-control-eccn.html

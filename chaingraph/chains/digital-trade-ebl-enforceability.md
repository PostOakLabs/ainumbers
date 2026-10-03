# eBL MLETR Conformance & Corridor Enforceability

W-A. MLETR functional-equivalence + cross-corridor enforceability (ART-53) -> instrument/jurisdiction classification (510) -> Merkle integrity over the authoritative copy (cry-04). The flagship decision chain: will this electronic bill of lading hold up at both ends?

- Page: https://ainumbers.co/chaingraph/chains/digital-trade-ebl-enforceability.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/digital-trade-ebl-enforceability.md

## Workflow chain: eBL MLETR Conformance & Corridor Enforceability

W-A. MLETR functional-equivalence + cross-corridor enforceability (ART-53) -> instrument/jurisdiction classification (510) -> Merkle integrity over the authoritative copy (cry-04). The flagship decision chain: will this electronic bill of lading hold up at both ends?

Domain: Digital Trade

### Steps

1. art-53-mletr-ebl-conformance-validator
   conformance_grade and enforceability_tier (H1) feed the classifier
2. 510-digital-asset-regulatory-classifier
   classification verdict (H2) feeds the integrity verifier
3. cry-04-merkle-batch-verifier
   Exports composite enforceability artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We tokenise the bill of lading so title moves on a DLT rail. Which regulatory regimes pick up that asset, and where does the corridor grade stand?
Run the AINumbers MCP tool `run_chain` with {"chain":"digital-trade-ebl-enforceability"} and read `510-digital-asset-regulatory-classifier.classification_results`.
Re-run with `inputs` for `510-digital-asset-regulatory-classifier`, reusing the values that result echoed, with `asset_type` set to "cbdc". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/digital-trade-ebl-enforceability.html

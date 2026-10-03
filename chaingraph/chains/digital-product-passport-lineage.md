# Digital Product Passport Lineage (EU ESPR / CIRPASS-2 / GS1 Digital Link)

Validate DPP data carrier against CIRPASS-2 Core Ontology (art-115) → build cradle-to-gate hash-only supplier lineage with carbon aggregation (art-116) → verify consumer/resale authenticity + ownership continuity (art-117). EU Central DPP Registry live 19 Jul 2026.

- Page: https://ainumbers.co/chaingraph/chains/digital-product-passport-lineage.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/digital-product-passport-lineage.md

## Workflow chain: Digital Product Passport Lineage (EU ESPR / CIRPASS-2 / GS1 Digital Link)

Validate DPP data carrier against CIRPASS-2 Core Ontology (art-115) → build cradle-to-gate hash-only supplier lineage with carbon aggregation (art-116) → verify consumer/resale authenticity + ownership continuity (art-117). EU Central DPP Registry live 19 Jul 2026.

Domain: Supply-Chain Traceability

### Steps

1. art-115-dpp-data-carrier-validator
   CIRPASS-2 conformance result feeds lineage building
2. art-116-product-lineage-builder
   anchored supplier lineage feeds authenticity verification
3. art-117-product-authenticity-verifier
   Exports authenticity artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A buyer wants assurance this resale unit was not diverted mid-chain. Does every ownership transfer on the passport hand off to the party the previous one named?
Run the AINumbers MCP tool `run_chain` with {"chain":"digital-product-passport-lineage"} and read `art-117-product-authenticity-verifier.ownership_continuous`.
Re-run with `inputs` for `art-117-product-authenticity-verifier`, reusing the values that result echoed, with `ownership_transfers` changed so the second transfer starts from an address no earlier transfer reached. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/digital-product-passport-lineage.html

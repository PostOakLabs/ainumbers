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

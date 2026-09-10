# Pharma Serialization & Saleable-Returns Custody (DSCSA / EU FMD)

Verify DSCSA T3 + GS1 SGTIN and EPCIS event (art-112) → verify saleable returns against the original transaction (art-113) → assess suspect/illegitimate product and required FDA actions (art-114). Client-side, zero-egress alternative to a permissioned serialization consortium.

- Page: https://ainumbers.co/chaingraph/chains/pharma-serialization-custody.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pharma-serialization-custody.md

## Workflow chain: Pharma Serialization & Saleable-Returns Custody (DSCSA / EU FMD)

Verify DSCSA T3 + GS1 SGTIN and EPCIS event (art-112) → verify saleable returns against the original transaction (art-113) → assess suspect/illegitimate product and required FDA actions (art-114). Client-side, zero-egress alternative to a permissioned serialization consortium.

Domain: Supply-Chain Traceability

### Steps

1. art-112-dscsa-transaction-statement-verifier
   verified T3 + SGTIN feeds saleable-returns matching
2. art-113-saleable-returns-verifier
   return verdict feeds suspect-product assessment
3. art-114-suspect-product-quarantine
   Exports custody artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

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

### Ask your agent

Question: A pharmacy returned a serialized pack to our wholesaler desk. Does it qualify as a saleable return, or must we refuse it?
Run the AINumbers MCP tool `run_chain` with {"chain":"pharma-serialization-custody"} and read `art-113-saleable-returns-verifier.verdict`.
Re-run with `inputs` for `art-113-saleable-returns-verifier`, reusing the values that result echoed, with `within_resale_window` set to false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/pharma-serialization-custody.html

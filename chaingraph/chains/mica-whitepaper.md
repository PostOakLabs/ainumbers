# Crypto-Asset Whitepaper Conformance

Art 6/8 whitepaper Annex I completeness + iXBRL / ESMA MiCA taxonomy conformance (ART-102) -> Merkle integrity (cry-04). A hash-anchored conformance target distinct from any shipped tool.

- Page: https://ainumbers.co/chaingraph/chains/mica-whitepaper.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-whitepaper.md

## Workflow chain: Crypto-Asset Whitepaper Conformance

Art 6/8 whitepaper Annex I completeness + iXBRL / ESMA MiCA taxonomy conformance (ART-102) -> Merkle integrity (cry-04). A hash-anchored conformance target distinct from any shipped tool.

Domain: Digital-Asset Rails

### Steps

1. art-102-crypto-asset-whitepaper-linter
   conformance grade + gaps (H1) feed the verifier
2. cry-04-merkle-batch-verifier
   Exports composite whitepaper artifact with Merkle-root execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our whitepaper draft is due at the regulator. What conformance grade does the linter give once every required section is complete?
Run the AINumbers MCP tool `run_chain` with {"chain":"mica-whitepaper"} and read `art-102-crypto-asset-whitepaper-linter.conformance_grade`.
Re-run with `inputs` for `art-102-crypto-asset-whitepaper-linter`, reusing the values that result echoed, with `inputs` changed so all ten sections are complete and iXBRL validates. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mica-whitepaper.html

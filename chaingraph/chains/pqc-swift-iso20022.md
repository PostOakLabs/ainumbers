# SWIFT / ISO 20022 PQC Readiness

HNDL quantum-risk prioritisation (500) -> SWIFT/ISO 20022 PQC readiness + BAH signature-bloat sizing per BIS Leap Phase 2 (ART-87) -> Merkle integrity (cry-04). Sizes the ~12.9x payload growth against message limits.

- Page: https://ainumbers.co/chaingraph/chains/pqc-swift-iso20022.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-swift-iso20022.md

## Workflow chain: SWIFT / ISO 20022 PQC Readiness

HNDL quantum-risk prioritisation (500) -> SWIFT/ISO 20022 PQC readiness + BAH signature-bloat sizing per BIS Leap Phase 2 (ART-87) -> Merkle integrity (cry-04). Sizes the ~12.9x payload growth against message limits.

Domain: Post-Quantum Cryptography

### Steps

1. 500-hndl-quantum-risk-scorer
   HNDL priority per flow (H1) feeds the readiness checker
2. art-87-iso20022-pqc-readiness-checker
   readiness + size-breach flags (H2) feed the verifier
3. cry-04-merkle-batch-verifier
   Exports composite ISO 20022 readiness artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

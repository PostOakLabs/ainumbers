# Screening List-Coverage Conformance

Screening config conformance vs EU consolidated + UN + UK Sanctions List (post-OFSI-closure 28 Jan 2026) + OFAC SDN with nexus gating (ART-92) -> Merkle integrity (cry-04).

- Page: https://ainumbers.co/chaingraph/chains/sanctions-list-coverage.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-list-coverage.md

## Workflow chain: Screening List-Coverage Conformance

Screening config conformance vs EU consolidated + UN + UK Sanctions List (post-OFSI-closure 28 Jan 2026) + OFAC SDN with nexus gating (ART-92) -> Merkle integrity (cry-04).

Domain: Sanctions

### Steps

1. art-92-screening-list-coverage-checker
   coverage grade + gaps (H1) feed the verifier
2. cry-04-merkle-batch-verifier
   Exports composite coverage artifact with Merkle-root execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

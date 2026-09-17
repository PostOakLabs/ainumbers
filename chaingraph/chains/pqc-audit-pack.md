# PQC Migration Audit Pack

W-G convergence terminal. Merkle integrity over the PQC protocol decision set (cry-04) -> Merkle-root audit receipt (cry-05) -> regulator/board-framed cover memo (ptg-01). The existing pqc-migration chain and the protocol chains feed in.

- Page: https://ainumbers.co/chaingraph/chains/pqc-audit-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/pqc-audit-pack.md

## Workflow chain: PQC Migration Audit Pack

W-G convergence terminal. Merkle integrity over the PQC protocol decision set (cry-04) -> Merkle-root audit receipt (cry-05) -> regulator/board-framed cover memo (ptg-01). The existing pqc-migration chain and the protocol chains feed in.

Domain: Post-Quantum Cryptography

### Steps

1. cry-04-merkle-batch-verifier
   batch integrity over PQC protocol artifacts (H1) feeds the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Merkle-root receipt (H2) feeds the memo generator
3. ptg-01-ap2-prompt-template-generator
   Exports composite PQC audit pack with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

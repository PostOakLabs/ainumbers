# Reserve Proof Verification

Single-node D0 diagnostic verifying a Merkle-sum Proof-of-Reserves customer-inclusion proof against a declared root, plus a Chainlink PoR / NAVLink round staleness and deviation check.

- Page: https://ainumbers.co/chaingraph/chains/reserve-proof-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/reserve-proof-verification.md

## Workflow chain: Reserve Proof Verification

Single-node D0 diagnostic verifying a Merkle-sum Proof-of-Reserves customer-inclusion proof against a declared root, plus a Chainlink PoR / NAVLink round staleness and deviation check.

Domain: Verification & Proof Receipts

### Steps

1. art-280-reserve-proof-verifier
   reserve_proof_determination and not_proven feed the issuer or auditor compliance record; composes with VR-1 (verify_eth_state_proof) when an on-chain storage proof is available; standalone otherwise

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

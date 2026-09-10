# Canton Selective-Disclosure DvP Attestation

Attest that a Canton DvP privacy partition is sound: each counterparty sees only its leg, both views reconcile to one atomic commitment, no cross-leg leakage. PFMI P12 atomic DvP (507) → selective-disclosure partition and view-reconciliation attestation (art-108) → off-protocol zero-knowledge compliance proof that the views reconcile without revealing the counter-leg (cry-01). Optional Ed25519 §16 proof binds each party attestation to a key.

- Page: https://ainumbers.co/chaingraph/chains/canton-selective-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-selective-disclosure.md

## Workflow chain: Canton Selective-Disclosure DvP Attestation

Attest that a Canton DvP privacy partition is sound: each counterparty sees only its leg, both views reconcile to one atomic commitment, no cross-leg leakage. PFMI P12 atomic DvP (507) → selective-disclosure partition and view-reconciliation attestation (art-108) → off-protocol zero-knowledge compliance proof that the views reconcile without revealing the counter-leg (cry-01). Optional Ed25519 §16 proof binds each party attestation to a key.

Domain: Digital-Asset Rails

### Steps

1. 507-canton-dvp-atomicity-validator
   atomicity/finality verdict feeds Stage 2 partition attestation
2. art-108-canton-selective-disclosure
   per-party view-reconciliation attestation feeds Stage 3 ZK disclosure proof
3. cry-01-zk-compliance-proof-generator
   Exports composite selective-disclosure artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

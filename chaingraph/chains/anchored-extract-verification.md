# Anchored Extract Verification

Single-node diagnostic verifying an extract's Merkle inclusion against a root only when that root is externally anchored (RFC 3161, OpenTimestamps, Sigstore, or on-chain via VR-1) or is a recognized OCG artifact envelope.

- Page: https://ainumbers.co/chaingraph/chains/anchored-extract-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/anchored-extract-verification.md

## Workflow chain: Anchored Extract Verification

Single-node diagnostic verifying an extract's Merkle inclusion against a root only when that root is externally anchored (RFC 3161, OpenTimestamps, Sigstore, or on-chain via VR-1) or is a recognized OCG artifact envelope.

Domain: Verification & Proof Receipts

### Steps

1. art-286-anchored-extract-verifier
   anchored_extract_determination and escalation feed the auditor's evidence-inclusion workpaper; composes with VR-1 (verify_eth_state_proof) for the on-chain anchor class, standalone otherwise

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

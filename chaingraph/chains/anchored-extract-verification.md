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

### Ask your agent

Question: A vendor sent an extract with its own Merkle root. Does the verifier accept that root, and what does it take before a mismatch escalates?
Run the AINumbers MCP tool `run_chain` with {"chain":"anchored-extract-verification"} and read `art-286-anchored-extract-verifier.anchored_extract_determination`.
Re-run with `inputs` for `art-286-anchored-extract-verifier`, reusing the values that result echoed, with `source_class` set to "ocg_artifact". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/anchored-extract-verification.html

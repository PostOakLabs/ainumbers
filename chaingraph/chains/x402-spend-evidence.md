# x402 Spend Evidence Pack

Linear three-step evidence pipeline recomputing the trust signals behind an x402/EIP-3009 TransferWithAuthorization: EIP-712 digest recomputation, ECDSA signer recovery, and domain/nonce/window verification. Each step's fields compose into the x402_spend_evidence pack that a downstream agent or human uses to decide whether to trust an authorization; this is an evidence bundle, not a settlement proof.

- Page: https://ainumbers.co/chaingraph/chains/x402-spend-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/x402-spend-evidence.md

## Workflow chain: x402 Spend Evidence Pack

Linear three-step evidence pipeline recomputing the trust signals behind an x402/EIP-3009 TransferWithAuthorization: EIP-712 digest recomputation, ECDSA signer recovery, and domain/nonce/window verification. Each step's fields compose into the x402_spend_evidence pack that a downstream agent or human uses to decide whether to trust an authorization; this is an evidence bundle, not a settlement proof.

Domain: Digital-Asset Rails

### Steps

1. art-590-x402-eip712-digest-recomputer
   recomputes the exact EIP-712 digest bytes that signer recovery verifies against
2. art-591-x402-signer-recovery-verifier
   recovers the signer address and reports the claimed_from match, alongside the digest, in the assembled evidence pack
3. art-592-x402-domain-nonce-window-checker
   domain/window/nonce verdict is the terminal step, combining with the digest and recovery results into the x402_spend_evidence pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An x402 payment authorization arrives with a signature that verifies. Before we ship the goods, has this authorization nonce already been spent?
Run the AINumbers MCP tool `run_chain` with {"chain":"x402-spend-evidence"} and read `art-592-x402-domain-nonce-window-checker.verdict`.
Re-run with `inputs` for `art-592-x402-domain-nonce-window-checker`, reusing the values that result echoed, with `nonce_already_used` set to true. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/x402-spend-evidence.html

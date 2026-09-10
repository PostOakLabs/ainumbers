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

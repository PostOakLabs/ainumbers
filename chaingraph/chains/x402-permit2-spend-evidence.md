# x402 Permit2 Spend Evidence Pack

Linear two-step evidence pipeline for the Permit2 asset-transfer method of an x402 exact or upto payment, the sibling of the EIP-3009 pipeline. The first step recomputes the Permit2 typed-data digest the payer signed and reports the binding, window, nonce-space and signature-form facts around it; the second step recovers the signer from that digest and reports whether the recovered address matches the claimed payer. The two outputs compose into an evidence pack a downstream agent or a human reads before relying on an authorization. This is an evidence bundle and never a settlement proof: no chain is read, nothing is submitted, and any fact whose input was not declared reports NOT_EVALUATED.

- Page: https://ainumbers.co/chaingraph/chains/x402-permit2-spend-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/x402-permit2-spend-evidence.md

## Workflow chain: x402 Permit2 Spend Evidence Pack

Linear two-step evidence pipeline for the Permit2 asset-transfer method of an x402 exact or upto payment, the sibling of the EIP-3009 pipeline. The first step recomputes the Permit2 typed-data digest the payer signed and reports the binding, window, nonce-space and signature-form facts around it; the second step recovers the signer from that digest and reports whether the recovered address matches the claimed payer. The two outputs compose into an evidence pack a downstream agent or a human reads before relying on an authorization. This is an evidence bundle and never a settlement proof: no chain is read, nothing is submitted, and any fact whose input was not declared reports NOT_EVALUATED.

Domain: Digital-Asset Rails

### Steps

1. art-699-x402-permit2-evidence-recomputer
   recomputes the Permit2 digest bytes and emits handoff_591, which carries that digest with the claimed payer and the signature components in the shape the next step reads
2. art-591-x402-signer-recovery-verifier
   recovers the signer address from those digest bytes and reports the claimed-from match, which is the terminal fact in the assembled evidence pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

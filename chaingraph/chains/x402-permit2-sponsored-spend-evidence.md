# x402 Permit2 Sponsored Spend Evidence Pack

Linear three-step evidence pipeline for an x402 Permit2 payment that also carries the gas-sponsoring approval extension, where the payer signs a second message approving the transfer contract and a facilitator pays the gas to submit it. The first step recomputes the Permit2 transfer digest and, when the extension is present, emits the sponsored-approval facts and a handoff in the approval verifier's input shape; the second step recovers the transfer signer; the third recomputes the approval digest and reports whether its signer binds to the declared owner. The three outputs compose into an evidence pack covering both signatures. This is an evidence bundle and never a settlement proof: no chain is read, nothing is submitted, and the approval handoff carries nulls rather than a guess when the token domain name and version were not declared.

- Page: https://ainumbers.co/chaingraph/chains/x402-permit2-sponsored-spend-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/x402-permit2-sponsored-spend-evidence.md

## Workflow chain: x402 Permit2 Sponsored Spend Evidence Pack

Linear three-step evidence pipeline for an x402 Permit2 payment that also carries the gas-sponsoring approval extension, where the payer signs a second message approving the transfer contract and a facilitator pays the gas to submit it. The first step recomputes the Permit2 transfer digest and, when the extension is present, emits the sponsored-approval facts and a handoff in the approval verifier's input shape; the second step recovers the transfer signer; the third recomputes the approval digest and reports whether its signer binds to the declared owner. The three outputs compose into an evidence pack covering both signatures. This is an evidence bundle and never a settlement proof: no chain is read, nothing is submitted, and the approval handoff carries nulls rather than a guess when the token domain name and version were not declared.

Domain: Digital-Asset Rails

### Steps

1. art-699-x402-permit2-evidence-recomputer
   recomputes the Permit2 transfer digest, emits handoff_591 for the recovery step, and emits handoff_612 carrying the sponsored approval fields in the shape the third step reads
2. art-591-x402-signer-recovery-verifier
   recovers the signer of the transfer digest and reports the claimed-from match, alongside the digest, in the assembled evidence pack
3. art-612-erc2612-permit-binding-verifier
   recomputes the approval digest from the handoff fields and reports whether its recovered signer binds to the declared owner, which is the terminal fact in the assembled pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A facilitator wants to pay the gas and submit both of my payer's signatures. Does the approval signature bind to the same owner as the transfer?
Run the AINumbers MCP tool `run_chain` with {"chain":"x402-permit2-sponsored-spend-evidence"} and read `art-612-erc2612-permit-binding-verifier.recovered_signer_matches_owner`.
Re-run with `inputs` for `art-612-erc2612-permit-binding-verifier`, reusing the values that result echoed, with `owner` changed so any other twenty byte address, which breaks the owner binding. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/x402-permit2-sponsored-spend-evidence.html

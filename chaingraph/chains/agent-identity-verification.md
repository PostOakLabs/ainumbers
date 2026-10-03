# Agent Identity Verification (RFC 9421 Web Bot Auth)

Reconstruct the RFC 9421 signature base and verify the Ed25519 Web Bot Auth signature against a caller-supplied public key (art-129) then validate the /.well-known/http-message-signatures-directory JWKS and keyid resolution (art-130) then validate the Signature Agent Card against the directory and emit an identity-trust verdict (art-131). Agent verifies agent, zero network, no human.

- Page: https://ainumbers.co/chaingraph/chains/agent-identity-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-identity-verification.md

## Workflow chain: Agent Identity Verification (RFC 9421 Web Bot Auth)

Reconstruct the RFC 9421 signature base and verify the Ed25519 Web Bot Auth signature against a caller-supplied public key (art-129) then validate the /.well-known/http-message-signatures-directory JWKS and keyid resolution (art-130) then validate the Signature Agent Card against the directory and emit an identity-trust verdict (art-131). Agent verifies agent, zero network, no human.

Domain: AI & Agent Governance

### Steps

1. art-129-webbotauth-signature-verifier
   Signature verdict feeds directory validation
2. art-130-signature-directory-validator
   Directory validation feeds agent card check
3. art-131-signature-agent-card-validator
   Exports identity-trust verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A caller claims to be our verified agent. Does its signed request check out against the directory and its card?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-identity-verification"} and read `art-131-signature-agent-card-validator.card_valid`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-identity-verification.html

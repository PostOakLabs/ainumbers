# Agentic Payment Mandate Lint

A2A agent card validation > x402 extension mandate validation > AP2 mandate credential build: a verify-then-build lint chain for agentic payment mandates supplied by the caller. Checks the calling agent's card, checks its x402 payment-extension mandate, then builds the AP2 verifiable credential representation. Read-only linting only; no payment execution, no wallet or custody action, no live network call.

- Page: https://ainumbers.co/chaingraph/chains/agentic-payment-mandate-lint.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agentic-payment-mandate-lint.md

## Workflow chain: Agentic Payment Mandate Lint

A2A agent card validation > x402 extension mandate validation > AP2 mandate credential build: a verify-then-build lint chain for agentic payment mandates supplied by the caller. Checks the calling agent's card, checks its x402 payment-extension mandate, then builds the AP2 verifiable credential representation. Read-only linting only; no payment execution, no wallet or custody action, no live network call.

Domain: Agent Economy

### Steps

1. art-25-a2a-agent-card-validator
   verdict, score, and has_ap2_extension establish whether the calling agent's card is well-formed and AP2-capable before its payment mandate is checked.
2. art-31-a2a-x402-extension-mandate-validator
   verdict, pass_count, and fail_count record whether the caller-supplied x402 payment-extension mandate checks out before the AP2 credential is built from it.
3. art-16-google-ap2-mandate-builder
   vdc and vdc_stage are the chain output - the AP2 W3C verifiable-credential mandate built from the caller's own inputs, gated behind the two prior lint passes.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

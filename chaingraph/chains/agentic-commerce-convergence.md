# Agentic Commerce Convergence

Binds one agent-run transaction across three independent agentic-commerce layers into a single hash-anchored composite: UCP cart/checkout discovery, ACP checkout conformance, and the AP2 payment mandate. UCP composes with AP2 rather than competing with it; this chain evidences that composition as one dated receipt.

- Page: https://ainumbers.co/chaingraph/chains/agentic-commerce-convergence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agentic-commerce-convergence.md

## Workflow chain: Agentic Commerce Convergence

Binds one agent-run transaction across three independent agentic-commerce layers into a single hash-anchored composite: UCP cart/checkout discovery, ACP checkout conformance, and the AP2 payment mandate. UCP composes with AP2 rather than competing with it; this chain evidences that composition as one dated receipt.

Domain: Agent Economy

### Steps

1. art-564-ucp-checkout-payload-lint
   Produces UCP cart/checkout resource conformance (CONFORMANT / NONCONFORMANT / UNKNOWN_VERSION) against the pinned v2026-04-08 schema, evidencing the discovery/cart layer of this declared transaction; each step keeps its own verdict scope, never merged into a single cross-layer determination
2. art-12-acp-checkout-conformance-validator
   Produces ACP checkout-session conformance findings over the same caller-declared amount/currency/merchant identity fields, evidencing the checkout layer of this declared transaction
3. art-01-ap2-mandate-chain-validator
   AP2 mandate-chain integrity determination over the same caller-declared amount/currency/merchant identity fields, closing the composite as the payment-authorization layer; terminal stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

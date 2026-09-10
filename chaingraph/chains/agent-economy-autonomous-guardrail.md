# Human-Not-Present Autonomous-Payment Guardrail

W-C. Spend-policy envelope (art-02) -> mandate scope & freshness (art-01) -> HNP guardrail verdict on the executed payment (ART-62). End-to-end gate for an agent paying with no human present.

- Page: https://ainumbers.co/chaingraph/chains/agent-economy-autonomous-guardrail.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-economy-autonomous-guardrail.md

## Workflow chain: Human-Not-Present Autonomous-Payment Guardrail

W-C. Spend-policy envelope (art-02) -> mandate scope & freshness (art-01) -> HNP guardrail verdict on the executed payment (ART-62). End-to-end gate for an agent paying with no human present.

Domain: Agent Economy

### Steps

1. art-02-agent-spend-policy-simulator
   spend envelope (H1) feeds the mandate validator
2. art-01-ap2-mandate-chain-validator
   mandate scope/freshness (H2) feeds the HNP verifier
3. art-62-ap2-payment-receipt-verifier
   Exports composite autonomous-guardrail artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

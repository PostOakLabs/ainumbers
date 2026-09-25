# Agentic Rail Chain

Agentic payments protocol comparison > AP2 mandate > Visa TAP signature inspection > Mastercard agentic token scope > A2A agent card validation > x402 payload decode > x402 settlement modelling > MCP developer readiness scorecard. The composer page routes the comparator into a card branch and an A2A branch that converge on the readiness scorecard; the chain records that run in the linear order the page renders, because a chain has no branch construct. The sibling chain agentic-rail-standards is the standards-only check over the card-network token specifications and shares no step with this one: this chain runs the protocol end to end, that one checks conformance with the published standards.

- Page: https://ainumbers.co/chaingraph/chains/agentic-rail.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agentic-rail.md

## Workflow chain: Agentic Rail Chain

Agentic payments protocol comparison > AP2 mandate > Visa TAP signature inspection > Mastercard agentic token scope > A2A agent card validation > x402 payload decode > x402 settlement modelling > MCP developer readiness scorecard. The composer page routes the comparator into a card branch and an A2A branch that converge on the readiness scorecard; the chain records that run in the linear order the page renders, because a chain has no branch construct. The sibling chain agentic-rail-standards is the standards-only check over the card-network token specifications and shares no step with this one: this chain runs the protocol end to end, that one checks conformance with the published standards.

Domain: AI & Agent Governance

### Steps

1. art-22-agentic-payments-protocol-comparator
   Root - routes to Branch A (AP2/Card) or Branch B (A2A/x402); converges at ART-18
2. art-16-google-ap2-mandate-builder
   Branch A A1 - AP2 payment mandate; feeds ART-23 Visa TAP
3. art-23-visa-trusted-agent-protocol-inspector
   Branch A A2 - Visa TAP compliance control; feeds ART-24
4. art-24-mastercard-agentic-token-builder
   Branch A A3 terminal - Mastercard agentic token scope; then ART-18
5. art-25-a2a-agent-card-validator
   Branch B B1 - A2A agent card compliance; feeds ART-26
6. art-26-x402-payload-decoder-flow-simulator
   Branch B B2 - x402 payload decode and lint; feeds ART-03
7. art-03-x402-settlement-modeler
   Branch B B3 terminal - x402 settlement cost and finality; then ART-18
8. art-18-mcp-developer-readiness-scorecard
   Terminal - both branches converge; final agentic-rail compliance mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

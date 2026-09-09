# Tempo Agentic Checkout

W-D chain. x402/MPP protocol decode → TIP-20 settlement mapper.

- Page: https://ainumbers.co/chaingraph/chains/tempo-agentic-checkout.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-agentic-checkout.md

## Workflow chain: Tempo Agentic Checkout

W-D chain. x402/MPP protocol decode → TIP-20 settlement mapper.

Domain: Digital-Asset Rails

### Steps

1. art-26-x402-payload-decoder-flow-simulator
   protocol_decode and payment_details feed Stage 2 TIP-20 settlement mapping
2. art-40-tempo-agentic-checkout
   Exports TIP-20 settlement artifact with execution_hash; memo → remittance_information crosswalk - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

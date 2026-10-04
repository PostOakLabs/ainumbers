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

### Ask your agent

Question: A partner sent this x402 header for an agentic checkout. Will the decoder take it as well formed?
Run the AINumbers MCP tool `run_chain` with {"chain":"tempo-agentic-checkout"} and read `art-26-x402-payload-decoder-flow-simulator.is_json`.
Re-run with `inputs` for `art-26-x402-payload-decoder-flow-simulator`, reusing the values that result echoed, with `header_or_payload` set to "vouch exact {broken". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/tempo-agentic-checkout.html

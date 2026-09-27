---
name: ap2-cart-to-payment-chain
description: "Build an AP2 mandate, validate it, hash-chain the cart, and correlate it with an x402 settlement. Use when the task is an agentic commerce or payments question. Written for the agentic payments audience."
license: "CC-BY-4.0"
compatibility: "Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)"
metadata:
  source: "ainumbers.co/mcp/showcase-prompts.json"
  prompt_id: "ap2-cart-to-payment-chain"
  verify_surface: "https://ledger.ainumbers.co/ https://mcp.ainumbers.co/mcp"
  version: "647bdbeed4d9"
---

# AP2 cart to payment chain

Build an AP2 mandate, validate it, hash-chain the cart, and correlate it with an x402 settlement.

## Prompt

Walk one synthetic purchase through the full AP2 evidence chain.

1. Call draft_ap2_mandate_credential for a synthetic cart (two line items, a spend cap, an expiry). Record the credential id.
2. Call validate_ap2_mandate_credential on the draft. Confirm the signature structure and the cap/expiry fields; record pass/fail.
3. Tamper-test: change one line item's price in the signed cart, re-validate, and confirm the validator rejects it. Revert.
4. Call build_ap2_cartmandate_hashchain over the cart events. Record the chain root.
5. Call validate_ap2_mandate_chain on the chain. Record pass/fail and which links are covered.
6. Call simulate_x402_flow for the settlement, then correlate_ap2_cartmandate_x402 to bind the settlement to the mandate chain. Record the correlation verdict.
7. build_session_receipt over every hash; give me the ledger link.
8. Write the note for the payments team: which claims the chain proves (mandate integrity, cart binding, settlement correlation), what it does not prove (merchant delivery), and the ledger link.
Call shape: every ChainGraph node tool takes its arguments nested under one wrapper object, e.g. {"policy_parameters": { ... }}; flat arguments are discarded by schema validation. If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.

## How to run

Connect an MCP-capable host to https://mcp.ainumbers.co/mcp, then give the prompt above to the assistant.

Use synthetic inputs only. Never paste personal or production data.

### Verify what came back

- https://ledger.ainumbers.co/
- https://mcp.ainumbers.co/mcp

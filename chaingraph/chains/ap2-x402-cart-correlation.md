# AP2 x402 Cart Correlation

Builds an illustrative AP2 CartMandate with a deterministic hash-chain over its cart line items, then checks whether that CartMandate's total and merchant plausibly correlate with a caller-supplied x402_spend_evidence pack (from the x402-spend-evidence chain). Output vocabulary is CORRELATION_STATUS (CORRELATED / NOT_CORRELATED / INDETERMINATE) - a plausibility check over two independently-produced artifacts, never a cryptographic binding. Google has not shipped an AP2-compatible x402 extension; no field or code path here implies one exists. Zero network calls; never a facilitator, proxy, gateway, or settlement relay.

- Page: https://ainumbers.co/chaingraph/chains/ap2-x402-cart-correlation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ap2-x402-cart-correlation.md

## Workflow chain: AP2 x402 Cart Correlation

Builds an illustrative AP2 CartMandate with a deterministic hash-chain over its cart line items, then checks whether that CartMandate's total and merchant plausibly correlate with a caller-supplied x402_spend_evidence pack (from the x402-spend-evidence chain). Output vocabulary is CORRELATION_STATUS (CORRELATED / NOT_CORRELATED / INDETERMINATE) - a plausibility check over two independently-produced artifacts, never a cryptographic binding. Google has not shipped an AP2-compatible x402 extension; no field or code path here implies one exists. Zero network calls; never a facilitator, proxy, gateway, or settlement relay.

Domain: Agent Economy

### Steps

1. art-595-ap2-cartmandate-hashchain-builder
   cart_root, cart_items, and merchant are the CartMandate fields the correlation step checks against a caller-supplied x402_spend_evidence pack.
2. art-596-ap2-x402-cart-correlation
   terminal step - independently re-derives cart_chain_intact from cart_items and cart_root, then checks the cart total and merchant against the x402_spend_evidence pack's authorization.value and authorization.to, reporting CORRELATION_STATUS.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A settlement payload arrived with the cart mandate attached. Do the authorized amount and the payee line up with what the cart says?
Run the AINumbers MCP tool `run_chain` with {"chain":"ap2-x402-cart-correlation"} and read `art-596-ap2-x402-cart-correlation.correlation_status`.
Re-run with `inputs` for `art-596-ap2-x402-cart-correlation`, reusing the values that result echoed, with `merchant` set to "0x9999000000000000000000000000000000000001". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ap2-x402-cart-correlation.html

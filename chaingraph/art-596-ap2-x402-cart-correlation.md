# Ap2 X402 Cart Correlation

Correlates a built AP2 CartMandate (cart_root, cart_items, merchant) against an x402_spend_evidence pack: does the cart total (sum of quantity*unit_price per currency) match the x402 authorization's value, does the CartMandate's merchant map to the authorization's recipient address, and does the CartMandate's own hash-chain independently re-verify against the supplied cart_items (never trusted as a self-reported flag). Output vocabulary is CORRELATION_STATUS (CORRELATED / NOT_CORRELATED / INDETERMINATE) - this is a plausibility check over two independently-produced artifacts, never a cryptographic binding. Google has not shipped an AP2-compatible x402 extension; no field or code path here implies one exists. Zero network calls; never a facilitator, proxy, gateway, or settlement relay.

- Page: https://ainumbers.co/chaingraph/art-596-ap2-x402-cart-correlation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-596-ap2-x402-cart-correlation.md
- MCP tool: correlate_ap2_cartmandate_x402 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cart_root (string, optional)
- cart_items (array, optional)
- merchant (string, optional)
- token_decimals (integer, optional)
- x402_spend_evidence (object, optional)

## Outputs

- correlation_status (string, optional)
- cart_total_matches_authorization_value (boolean,null, optional)
- cart_total_atomic (string,null, optional)
- authorization_value_atomic (string,null, optional)
- merchant_matches_authorization_to (boolean,null, optional)
- cart_chain_intact (boolean, optional)
- disclosure (string, optional)
- reasons (array, optional)

## Sample

```json
{
  "cart_root": "0x4e1a3b0922583d53d2c4090386f3438fd367bb08d5e12716bdf4a790eeb1dd92",
  "cart_items": [
    {
      "sku": "SKU-100",
      "description": "Widget",
      "quantity": 2,
      "unit_price": 0.25,
      "currency": "USD"
    },
    {
      "sku": "SKU-200",
      "description": "Gadget",
      "quantity": 1,
      "unit_price": 0.5,
      "currency": "USD"
    }
  ],
  "merchant": "0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667",
  "token_decimals": 6,
  "x402_spend_evidence": {
    "authorization": {
      "from": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
      "to": "0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667",
      "value": "1000000",
      "validAfter": "0",
      "validBefore": "2000000000",
      "nonce": "0x0000000000000000000000000000000000000000000000000000000000000001"
    },
    "digest": "0xb5edd5c45c7ad92459eb789ae4449a9e2a79ce09a9a4122388ae91d7b938d972",
    "recovered_signer": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    "verdict": "AUTHORIZATION_VALID",
    "disclosure": "ev"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `correlate_ap2_cartmandate_x402` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

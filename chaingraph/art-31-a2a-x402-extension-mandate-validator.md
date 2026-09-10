# A2A x402-Extension Mandate Validator

Validates the A2A x402 extension (Coinbase/MetaMask/Ethereum Foundation) that carries crypto-payment authority inside an AP2 mandate: extension declaration in the A2A agent card, payment-authority scope, settlement-rail binding, exact-scheme x402 PaymentPayload lint, and mandate-to-payment-leg consistency. PASS/WARN/FAIL verdict + execution_hash. Educational/simulation.

- Page: https://ainumbers.co/chaingraph/art-31-a2a-x402-extension-mandate-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-31-a2a-x402-extension-mandate-validator.md
- MCP tool: validate_a2a_x402_mandate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_card (unknown, required)
- mandate_cap (unknown, required)
- payment_payload (unknown, required)

## Outputs

- checks (array, optional)
- extension_declared (boolean, optional)
- fail_count (integer, optional)
- pass_count (integer, optional)
- payment_authority_scope_present (boolean, optional)
- settlement_rail_bound (boolean, optional)
- verdict (string, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "agent_card": {
    "capabilities": {
      "extensions": [
        {
          "uri": "https://ainumbers.co/x402/v1",
          "params": {
            "payment_authority": {
              "scope": [
                "payment"
              ],
              "max_amount": 1000,
              "asset": "USDC"
            },
            "settlement_rail": {
              "scheme": "exact",
              "network": "base-sepolia",
              "asset": "USDC"
            }
          }
        }
      ]
    }
  },
  "payment_payload": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "500",
    "resource": "https://api.example.com/pay",
    "payTo": "0xabc123",
    "asset": "USDC"
  },
  "mandate_cap": {
    "max_amount": 1000,
    "asset": "USDC"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_a2a_x402_mandate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

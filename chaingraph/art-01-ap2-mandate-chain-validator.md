# AP2 Mandate-Chain Validator

Validates AP2 v0.2 Intent→Cart→Payment mandate trio: signature-chain integrity, scope/limit consistency, TTL/expiry, over-spend detection, Human-Not-Present autonomous-agent flows. Publishes conformance test-vector fixtures.

- Page: https://ainumbers.co/chaingraph/art-01-ap2-mandate-chain-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-01-ap2-mandate-chain-validator.md
- MCP tool: validate_ap2_mandate_chain (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cart (unknown, optional)
- hnp_mode (unknown, optional)
- intent (unknown, optional)
- payment (unknown, optional)
- validate_at (boolean, required)

## Outputs

- validation_verdict (string, optional)
- checks_run (integer, optional)
- failing_checks (array, optional)
- warning_checks (array, optional)
- mandate_ids (object, optional)
- has_cart (boolean, optional)
- human_not_present (boolean, optional)

## Sample

```json
{
  "validate_at": "2026-06-18T12:00:00.000Z",
  "hnp_mode": "strict",
  "intent": {
    "mandate_type": "intent",
    "mandate_id": "int-001",
    "version": "2.0",
    "issued_at": "2026-06-18T10:00:00.000Z",
    "expires_at": "2026-06-19T10:00:00.000Z",
    "issuer_id": "agent-alpha",
    "scope": {
      "merchant_ids": [
        "merchant-acme"
      ],
      "category_codes": [
        "5411",
        "5912"
      ],
      "currency": "USD",
      "max_amount": 500
    },
    "human_not_present": false
  },
  "cart": {
    "mandate_type": "cart",
    "mandate_id": "crt-001",
    "version": "2.0",
    "issued_at": "2026-06-18T11:00:00.000Z",
    "expires_at": "2026-06-19T11:00:00.000Z",
    "parent_mandate_id": "int-001",
    "parent_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "cart_total": 38.97,
    "currency": "USD",
    "merchant_id": "merchant-acme"
  },
  "payment": {
    "mandate_type": "payment",
    "mandate_id": "pay-001",
    "version": "2.0",
    "issued_at": "2026-06-18T11:54:00.000Z",
    "expires_at": "2026-06-18T12:30:00.000Z",
    "parent_mandate_id": "crt-001",
    "parent_hash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    "amount": 38.97,
    "currency": "USD",
    "merchant_id": "merchant-acme",
    "payment_method": "card_on_file",
    "human_not_present": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_ap2_mandate_chain` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

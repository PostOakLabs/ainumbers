# ACP Checkout Conformance Validator

OpenAI/Stripe Agentic Commerce Protocol (ACP): CheckoutRequest/Response field conformance (10 required fields each), Shared Payment Token structure, ISO 4217 currency, TTL, signature prefix validation. Suite now covers both AP2 (Google) and ACP (OpenAI/Stripe).

- Page: https://ainumbers.co/chaingraph/art-12-acp-checkout-conformance-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-12-acp-checkout-conformance-validator.md
- MCP tool: validate_acp_checkout (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- message_type_override (unknown, optional)
- payload (unknown, required)

## Outputs

- checks (array, optional)
- currency (string, optional)
- fail_count (integer, optional)
- merchant_id (string, optional)
- overall_status (string, optional)
- pass_count (integer, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "message_type_override": "auto",
  "payload": {
    "message_type": "CheckoutRequest",
    "request_id": "req-abc-001",
    "merchant_id": "merchant-acme",
    "agent_id": "agent:acme:shopping-bot:v2",
    "amount": 49.99,
    "currency": "USD",
    "items": [
      {
        "sku": "WIDGET-001",
        "unit_price": 24.99,
        "quantity": 2
      }
    ],
    "timestamp": "2026-06-19T10:00:00.000Z",
    "redirect_url": "https://acme.com/checkout/confirm",
    "signature": "ed25519:MEYCIQDexampleSignatureHere",
    "idempotency_key": "idem-abc-001"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_acp_checkout` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

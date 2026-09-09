# Agent Payment Mandate Cross-Protocol Mapper

Translates an agentic-payment mandate declared under one protocol (AP2, x402, or ACP) into the field vocabulary of another, pivoting through one internal canonical schema so each protocol needs only one mapping in and one mapping out. Emits the translated mandate plus a mapping receipt: source digest, target digest, mapping-table version, and a declared lossy-fields list, so any field the source could not carry is surfaced rather than silently dropped. AP2 and x402 field usage verified against art-01, art-62, and art-26; ACP is a draft-generic profile pending independent confirmation of its public schema. Verify-only and translate-only: nothing here initiates, routes, or settles a payment.

- Page: https://ainumbers.co/chaingraph/art-476-map-agent-payment-mandate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-476-map-agent-payment-mandate.md
- MCP tool: map_agent_payment_mandate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- source_mandate (unknown, required)
- source_protocol (unknown, required)
- target_protocol (unknown, required)

## Outputs

- canonical_pivot (object, optional)
- mapping_ok (boolean, optional)
- mapping_receipt (object, optional)
- mapping_table_version (string, optional)
- missing_required_target_fields (array, optional)
- protocol_versions (object, optional)
- source_protocol (string, optional)
- target_protocol (string, optional)
- translated_mandate (object, optional)

## Sample

```json
{
  "source_protocol": "ap2",
  "target_protocol": "x402",
  "source_mandate": {
    "mandate_id": "ap2-pay-001",
    "mandate_type": "payment",
    "merchant_id": "merchant-42",
    "amount": 25.5,
    "currency": "USDC",
    "issued_at": "2026-07-24T10:00:00Z",
    "expires_at": "2026-07-24T11:00:00Z",
    "human_not_present": true,
    "scope": {
      "max_amount": 100,
      "merchant_ids": [
        "merchant-42"
      ]
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_agent_payment_mandate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

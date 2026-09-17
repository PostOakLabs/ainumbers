# Agent On-Behalf-Of (OBO) Mandate Validator

Validate an agent on-behalf-of (OBO) mandate: subject (the user being represented), bounded scope array, intent string, and a non-expired validity window (caller-supplied now_unix, no clock reads). Mismatch or expiry returns REFUSE. Aligns with the AP2 mandate-chain pattern (art-01). Consumes scope-revocation audit (art-150), feeds task lifecycle validator (art-152). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-151-agent-obo-mandate-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-151-agent-obo-mandate-validator.md
- MCP tool: validate_agent_obo_mandate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mandate (unknown, optional)
- now_unix (unknown, optional)

## Outputs

- gaps (array, optional)
- has_intent (boolean, optional)
- has_scope (boolean, optional)
- has_subject (boolean, optional)
- not_expired (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "mandate": {
    "subject": "user:alice@example.com",
    "intent": "retrieve_invoice_data",
    "scope": [
      "invoices:read",
      "payments:read"
    ],
    "valid_until_unix": 9999999999
  },
  "now_unix": 1000000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_agent_obo_mandate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

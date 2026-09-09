# Agent Commerce Cross-Protocol Conformance Validator

The synergy flagship. Validates a single agent purchase end-to-end across up to five protocols: AP2 v0.2 mandate chain (Intent → Cart → Payment), ACP checkout conformance (OpenAI/Stripe), Visa TAP RFC 9421 HTTP Message Signature inspection, x402 settlement leg, and Tempo MPP session/subscription pre-authorization (additive, validated when an mpp_session is supplied). Issues one unified PASS/WARN/FAIL verdict and a single execution_hash receipt (ChainGraph Standard v0.1 §4, chain_depth: 1). Consumes ART-01, ART-12, ART-03. Feeds CRY-05, PTG-01.

- Page: https://ainumbers.co/chaingraph/art-30-agent-commerce-conformance-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-30-agent-commerce-conformance-validator.md
- MCP tool: validate_agent_commerce_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- acp_payload (unknown, required)
- ap2_mandate_trio (unknown, required)
- mpp_session (unknown, required)
- tap_headers (unknown, required)
- x402_payload (unknown, required)

## Outputs

- checks (array, optional)
- fail_count (integer, optional)
- overall_status (string, optional)
- pass_count (integer, optional)
- protocols_validated (array, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "ap2_mandate_trio": {
    "intent": {
      "mandate_type": "intent",
      "mandate_id": "intent-001",
      "expires_at": "2026-12-31T00:00:00Z",
      "scope": {
        "merchant_ids": [
          "merchant-001"
        ],
        "currency": "USD",
        "max_amount": 500
      },
      "human_not_present": true,
      "issuer_id": "issuer:test"
    },
    "payment": {
      "mandate_type": "payment",
      "mandate_id": "pay-001",
      "parent_mandate_id": "intent-001",
      "parent_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "amount": 100,
      "currency": "USD",
      "human_not_present": true,
      "payment_method": "card"
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_agent_commerce_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

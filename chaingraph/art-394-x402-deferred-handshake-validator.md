# x402 Deferred-Scheme Handshake Validator

Validates a Cloudflare `deferred` x402 scheme handshake: 402 offer field shape (scheme:"deferred", id, termsUrl), RFC 9421 HTTP Message Signature covered-component coverage (@method, @target-uri, content-digest), and settlement-reference id continuity across a call sequence (uniqueness, no internal duplicates). Cryptographic signature verification reuses verify_webbotauth_signature (art-129); rollup/batch settlement arithmetic is owned by reconcile_x402_batch_settlement (art-61); this node validates the offer and handshake shape only. Scheme registry is a plugin surface and is not hard-coded.

- Page: https://ainumbers.co/chaingraph/art-394-x402-deferred-handshake-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-394-x402-deferred-handshake-validator.md
- MCP tool: validate_x402_deferred_handshake (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- covered_components (unknown, optional)
- id_continuity (unknown, optional)
- offer (unknown, optional)

## Outputs

- errors (integer, optional)
- findings (array, optional)
- passes (integer, optional)
- required_covered_components (array, optional)
- scope_note (string, optional)
- score (integer, optional)
- settlement_reference_id (string, optional)
- verdict (string, optional)
- warnings (integer, optional)

## Sample

```json
{
  "offer": {
    "scheme": "deferred",
    "id": "set-ref-001",
    "termsUrl": "https://merchant.example/terms/x402"
  },
  "covered_components": [
    "@method",
    "@target-uri",
    "content-digest"
  ],
  "id_continuity": {
    "prior_ids": [
      "set-ref-000"
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_x402_deferred_handshake` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

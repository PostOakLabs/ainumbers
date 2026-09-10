# KYA Credential x x402 Payload Scope Verifier

Cross-checks a declared KYA (Know Your Agent) credential's scope against a declared x402 PaymentPayload: amount vs the credential's spend cap, network/asset vs its allowed set, payee vs its merchant allowlist, validity window vs the payload's timestamps, and scope-string coverage of the payment scheme. Returns findings[] and a verdict of IN_SCOPE, OUT_OF_SCOPE, or INDETERMINATE (when the credential omits a claim the payload requires - never guessed). Verify-only: never fetches either input, never contacts Skyfire or a facilitator, performs no signature verification, and never initiates or settles an x402 payment.

- Page: https://ainumbers.co/chaingraph/art-565-kya-x402-scope-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-565-kya-x402-scope-verifier.md
- MCP tool: verify_kya_x402_scope (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- kya_credential (unknown, required)
- x402_payload (unknown, required)

## Outputs

- credential_audience (string, optional)
- credential_seller_service_id (string, optional)
- credential_subject (string, optional)
- findings (array, optional)
- indeterminate_reasons (array, optional)
- kya_claim_basis (string, optional)
- note (string, optional)
- payload_network (string, optional)
- payload_scheme (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- verdict (string, optional)

## Sample

```json
{
  "kya_credential": {
    "sub": "buyer-agent-001",
    "aud": "seller-agent-042",
    "ssi": "svc-abc123",
    "iss": "https://issuer.skyfire.xyz",
    "iat": 1754400000,
    "exp": 1754500000,
    "env": "production",
    "spend_cap_amt": "10000000",
    "allowed_networks": [
      "base"
    ],
    "allowed_assets": [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    ],
    "payee_allowlist": [
      "0xMERCHANT0000000000000000000000000000beef"
    ],
    "scope": [
      "payments:x402:exact"
    ]
  },
  "x402_payload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "base",
    "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "payload": {
      "signature": "0xsig",
      "authorization": {
        "from": "0xBUYER",
        "to": "0xMERCHANT0000000000000000000000000000beef",
        "value": "5000000",
        "validAfter": 1754400100,
        "validBefore": 1754400400,
        "nonce": "0x01"
      }
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_kya_x402_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

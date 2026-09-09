# Web Bot Auth Signature Verifier (RFC 9421)

Reconstruct the RFC 9421 signature base and verify the Ed25519 Web Bot Auth signature against a caller-supplied public key, zero network. Checks alg=ed25519, tag=web-bot-auth, and freshness. Feeds the signatures-directory validator (art-130).

- Page: https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-129-webbotauth-signature-verifier.md
- MCP tool: verify_webbotauth_signature (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "covered_components": [
    {
      "name": "method",
      "value": "POST"
    },
    {
      "name": "@authority",
      "value": "api.example.com"
    },
    {
      "name": "@path",
      "value": "/agent/v1/execute"
    }
  ],
  "signature_params": "(\"method\" \"@authority\" \"@path\");created=1750000000;keyid=\"key-2026-06\";tag=\"web-bot-auth\";alg=\"ed25519\"",
  "signature_b64": "ruUab1uVdHazfuOcU0E4qLcTnOM2Z7zYHiluP5qxDZkKbw8EjPNarFHL7G2fS2DhnFH1xlpbihrIkOm8jwxIDA==",
  "public_key_jwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "WrHvnND7oaWfvrGxUU3FNeJaQDwYj4K3e5fl0fH5p2g"
  },
  "alg": "ed25519",
  "created": 1750000000,
  "now_unix": 1750003600,
  "max_age_s": 3600
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_webbotauth_signature` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

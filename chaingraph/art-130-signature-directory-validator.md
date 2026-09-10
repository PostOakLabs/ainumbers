# HTTP Signatures Directory Validator

Validate the /.well-known/http-message-signatures-directory JWKS: well-formed, keys are OKP/Ed25519, the keyid from Signature-Input resolves to a key in the directory, well-known path correct. Agent fetches the directory once and passes the JSON. Consumes art-129, feeds art-131.

- Page: https://ainumbers.co/chaingraph/art-130-signature-directory-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-130-signature-directory-validator.md
- MCP tool: validate_signature_directory (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "well_known_path": "/.well-known/http-message-signatures-directory",
  "keyid": "key-2026-06",
  "directory_jwks": {
    "keys": [
      {
        "kty": "OKP",
        "crv": "Ed25519",
        "kid": "key-2026-06",
        "x": "WrHvnND7oaWfvrGxUU3FNeJaQDwYj4K3e5fl0fH5p2g"
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_signature_directory` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

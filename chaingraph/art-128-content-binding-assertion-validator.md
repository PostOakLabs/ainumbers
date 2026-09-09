# Content Binding Assertion Validator

Validate hard-binding (c2pa.hash.data/bmff, tamper-evident) vs soft-binding (watermark/fingerprint, survives re-encode). Confirms asset byte-hash matches claimed hard-binding hash. Emits TAMPER_EVIDENT / SOFT_BINDING_ONLY / UNBOUND verdict. Terminal stage.

- Page: https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-128-content-binding-assertion-validator.md
- MCP tool: validate_content_binding_assertion (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "binding_type": "hard",
  "asset_bytes_hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "claimed_hard_binding_hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "soft_binding_identifier_present": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_content_binding_assertion` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

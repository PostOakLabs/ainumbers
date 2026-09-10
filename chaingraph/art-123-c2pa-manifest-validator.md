# C2PA Content Credential Manifest Validator

Validate a decoded C2PA 2.x manifest: claim well-formedness, hard-binding hash assertion, and claim-signature reference. Feeds the Content Credential signature verifier (art-124). Underpins EU AI Act Art. 50 machine-readable marking (applies 2 Aug 2026).

- Page: https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.md
- MCP tool: validate_c2pa_manifest (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "claim_generator": "Adobe Firefly 3.0",
  "claim": {
    "format": "image/jpeg",
    "instanceID": "xmp:iid:0001"
  },
  "assertions": [
    {
      "label": "c2pa.actions"
    },
    {
      "label": "c2pa.hash.data"
    }
  ],
  "signature": {
    "present": true,
    "alg": "ES256"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_c2pa_manifest` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

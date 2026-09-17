# MCP Authorization Metadata Validator (RFC 9728)

Validate OAuth 2.0 Protected Resource Metadata per RFC 9728: resource URI (https-scheme), non-empty authorization_servers, scopes_supported, and bearer_methods_supported restricted to header/body/query. Flags each missing or malformed member. Consumes server identity verdict (art-147), feeds registry entry conformance check (art-149). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-148-mcp-authorization-metadata-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-148-mcp-authorization-metadata-validator.md
- MCP tool: validate_mcp_authorization_metadata (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- metadata (unknown, optional)

## Outputs

- auth_server_count (integer, optional)
- bearer_ok (boolean, optional)
- metadata_valid (boolean, optional)
- missing (array, optional)
- resource_ok (boolean, optional)
- scope_count (integer, optional)

## Sample

```json
{
  "metadata": {
    "resource": "https://api.example.com/mcp",
    "authorization_servers": [
      "https://auth.example.com"
    ],
    "scopes_supported": [
      "tools:read",
      "tools:call"
    ],
    "bearer_methods_supported": [
      "header"
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_mcp_authorization_metadata` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

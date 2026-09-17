# MCP Tool Scope & Revocation Auditor

Audit scoped and revocable MCP tool access per the new MCP specification: each granted tool must carry an explicit scope array, a revocation endpoint must be configured (https-scheme), and token rotation posture (max age vs elapsed time, next-key presence) must be healthy. Emits per-tool grant verdict and gap list. Feeds the on-behalf-of mandate validator (art-151). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-150-mcp-tool-scope-revocation-auditor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-150-mcp-tool-scope-revocation-auditor.md
- MCP tool: audit_mcp_tool_scope_revocation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- max_token_age_s (unknown, optional)
- next_token_present (unknown, optional)
- now_unix (unknown, optional)
- revocation_endpoint (unknown, optional)
- token_created_unix (unknown, optional)
- tool_grants (unknown, optional)

## Outputs

- audit_pass (boolean, optional)
- revocable (boolean, optional)
- rotation_ok (boolean, optional)
- scopes_ok (boolean, optional)
- token_age_s (integer, optional)
- ungated_tools (array, optional)

## Sample

```json
{
  "tool_grants": [
    {
      "tool": "search_files",
      "scopes": [
        "files:read"
      ]
    },
    {
      "tool": "write_file",
      "scopes": [
        "files:write"
      ]
    }
  ],
  "revocation_endpoint": "https://auth.example.com/revoke",
  "token_created_unix": 1000000,
  "now_unix": 1001000,
  "max_token_age_s": 3600,
  "next_token_present": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_mcp_tool_scope_revocation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

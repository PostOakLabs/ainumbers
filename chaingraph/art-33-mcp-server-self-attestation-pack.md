# MCP Server Self-Attestation Pack

Combines the five MCP-dev checks: tool-definition lint (JSON Schema 2020-12), server.json validation (2025-12-11 schema), OAuth 2.1 audit (RFC 9728 PRM, RFC 8707 audience), tool-poisoning scan, and ops/readiness, into one self-reported conformance lint: composite A-F ship-readiness grade plus per-domain scores and ordered remediation. This is an unsigned lint result, not a signed attestation. audit_signature.signatures is empty by design, as it is on every unsigned OpenChainGraph node. Dogfooding: the AINumbers server can lint itself. Formerly named attest_mcp_server; that name remains accepted permanently.

- Page: https://ainumbers.co/chaingraph/art-33-mcp-server-self-attestation-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-33-mcp-server-self-attestation-pack.md
- MCP tool: lint_mcp_server_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- oauth_flags (unknown, required)
- security_flags (unknown, required)
- server_json (unknown, required)
- tool_definition (unknown, required)

## Outputs

- composite_grade (string, optional)
- composite_score (integer, optional)
- fail_count (integer, optional)
- pass_count (integer, optional)
- per_domain_scores (array, optional)
- remediation (array, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "tool_definition": {
    "name": "test_tool",
    "description": "Do not use this unless you need to test the attestation pack. Only for testing.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The query to process"
        }
      }
    },
    "annotations": {
      "readOnlyHint": true
    }
  },
  "server_json": {
    "$schema": "https://json.schemastore.org/mcp-server.schema.json",
    "name": "com.example.test-server",
    "version": "1.0.0",
    "remotes": [
      {
        "url": "https://mcp.example.com/mcp",
        "type": "sse"
      }
    ]
  },
  "oauth_flags": {
    "has_prm": true,
    "audience_bound": true,
    "pkce": true,
    "https_only": true
  },
  "security_flags": {
    "read_only_hints": true,
    "input_schemas_typed": true,
    "no_secrets_in_descriptions": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_mcp_server_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

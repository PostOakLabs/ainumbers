# Agent Key Rotation Auditor

Audit key freshness and rotation posture: key age vs max-age policy, presence of a next-key and overlap window, algorithm is Ed25519. Emits HEALTHY / ROTATION_STAGED / ACTION_REQUIRED posture. Feeds the payment-rail trust crosswalk (art-133).

- Page: https://ainumbers.co/chaingraph/art-132-agent-key-rotation-auditor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-132-agent-key-rotation-auditor.md
- MCP tool: audit_agent_key_rotation (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "key_created_unix": 1750000000,
  "now_unix": 1750086400,
  "max_key_age_s": 7776000,
  "next_key_present": false,
  "algorithm": "ed25519"
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_agent_key_rotation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

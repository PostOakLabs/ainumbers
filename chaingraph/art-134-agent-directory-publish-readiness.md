# Agent Directory Publish Readiness Diagnostic

Diagnostic: is the operator ready to publish a verifiable Web Bot Auth identity? Checks well-known path, JWKS reachability flag, card completeness, rotation posture, Ed25519. Emits ready verdict and gap list. Terminal stage of agent-identity-publishing chain.

- Page: https://ainumbers.co/chaingraph/art-134-agent-directory-publish-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-134-agent-directory-publish-readiness.md
- MCP tool: assess_agent_directory_publish_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "well_known_path_ok": true,
  "jwks_reachable": true,
  "card_complete": true,
  "rotation_posture_ok": true,
  "alg_ed25519": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_agent_directory_publish_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

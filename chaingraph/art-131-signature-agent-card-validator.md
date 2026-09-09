# Signature Agent Card Validator

Validate the Signature Agent Card (Cloudflare/Bedrock AgentCore schema): required fields (name, operator, expected request rate, keys) and card keys consistent with the validated directory. Emits identity-trust verdict. Terminal stage of agent-identity-verification chain.

- Page: https://ainumbers.co/chaingraph/art-131-signature-agent-card-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-131-signature-agent-card-validator.md
- MCP tool: validate_signature_agent_card (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "card": {
    "name": "ExampleAgent/1.0",
    "operator": "Example Corp",
    "expected_request_rate": "1000/day",
    "keys": [
      {
        "kid": "key-2026-06"
      }
    ]
  },
  "directory_keyids": [
    "key-2026-06"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_signature_agent_card` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

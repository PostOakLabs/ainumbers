# Mastercard Agentic Token Scope Builder

Builds or lints a Mastercard Agent Pay Agentic Token scope: agent binding, merchant scope, consent policy (limits, expiry, velocity, MCC). The agent never receives the raw PAN (MDES tokenised). Branch A, node 3 of the Agentic Rail Chain. Promoted from T287.

- Page: https://ainumbers.co/chaingraph/art-24-mastercard-agentic-token-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-24-mastercard-agentic-token-builder.md
- MCP tool: build_mastercard_agentic_token (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "token_scope": {
    "agentId": "agent:test:v1",
    "merchantScope": [
      "merchant-001"
    ],
    "consentPolicy": {
      "perTransactionLimit": 50,
      "totalLimit": 500,
      "expiresAt": 1780000000
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_mastercard_agentic_token` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

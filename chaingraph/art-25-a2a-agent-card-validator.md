# A2A Agent Card Validator & Extension Checker

Validates an A2A agent-card.json against the v1.0 shape: identity fields, capabilities, extensions (AP2/x402), input/output modes, skills, provider, signed-card JWS block. Branch B, node 1 of the Agentic Rail Chain. Promoted from T283.

- Page: https://ainumbers.co/chaingraph/art-25-a2a-agent-card-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-25-a2a-agent-card-validator.md
- MCP tool: verify_a2a_agent_card (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_card (unknown, required)

## Outputs

- errors (integer, optional)
- findings (array, optional)
- has_ap2_extension (boolean, optional)
- has_signed_card (boolean, optional)
- passes (integer, optional)
- score (integer, optional)
- verdict (string, optional)
- warnings (integer, optional)

## Sample

```json
{
  "agent_card": {
    "name": "Test Agent",
    "description": "A test payment agent",
    "url": "https://agent.example.com",
    "version": "1.0",
    "protocolVersion": "1.0",
    "capabilities": {
      "streaming": false,
      "pushNotifications": false,
      "extensions": []
    },
    "defaultInputModes": [
      "text/plain"
    ],
    "defaultOutputModes": [
      "application/json"
    ],
    "skills": [
      {
        "id": "pay",
        "name": "Payment",
        "description": "Execute payments",
        "tags": [
          "payment"
        ]
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_a2a_agent_card` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

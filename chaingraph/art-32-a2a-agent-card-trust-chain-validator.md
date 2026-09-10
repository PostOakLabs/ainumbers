# A2A Agent-Card Trust-Chain Validator

The horizontal agent-to-agent trust complement. Validates an A2A v1.0 agent card (schema, signature, extension URIs) then assesses the delegated-authority trust chain into KYA-OS attestation + spend policy: chain depth <= 4, no scope escalation, validity windows <= 90 days. Trust PASS/WARN/FAIL determination + execution_hash.

- Page: https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-32-a2a-agent-card-trust-chain-validator.md
- MCP tool: validate_a2a_trust_chain (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_card (unknown, required)
- delegation_chain (array, required)
- spend_policy (unknown, required)

## Outputs

- card_schema_ok (boolean, optional)
- checks (array, optional)
- fail_count (integer, optional)
- no_expired_links (boolean, optional)
- no_scope_escalation (boolean, optional)
- pass_count (integer, optional)
- signature_block_present (boolean, optional)
- trust_determination (string, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "agent_card": {
    "name": "Test Agent",
    "url": "https://agent.example.com",
    "version": "1.0",
    "protocolVersion": "1.0",
    "capabilities": {
      "streaming": false
    },
    "skills": [
      {
        "id": "pay",
        "name": "Payment"
      }
    ],
    "signatures": [
      {
        "protected": "eyJhbGciOiJFZERTQSJ9",
        "signature": "abc123"
      }
    ]
  },
  "delegation_chain": [],
  "spend_policy": {
    "per_tx_cap": 100,
    "daily_cap": 1000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_a2a_trust_chain` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

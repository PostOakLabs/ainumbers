# Agent-Traffic Acceptance Policy Builder

Builds a policy mandate governing accepted AI agent types, identity verification level, velocity and value caps, payment rails, refund posture, retry policy, and blocking rules. Exports an agent-readable instructions block and a §4 hash-anchored artifact. Node 3 of 3 in the Agentic Checkout Chain.

- Page: https://ainumbers.co/chaingraph/art-21-agent-traffic-acceptance-policy-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-21-agent-traffic-acceptance-policy-builder.md
- MCP tool: build_agent_traffic_policy (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_types (unknown, required)
- block_rules (unknown, required)
- max_daily_val_usd (unknown, optional): Amount in US dollars
- max_single_val_usd (unknown, optional): Amount in US dollars
- max_tx_per_day (unknown, optional)
- max_tx_per_min (unknown, optional)
- rails (unknown, required)
- refund_posture (unknown, optional)
- retry_policy (unknown, optional)
- verification_level (unknown, optional)

## Outputs

- accepted_agent_types (array, optional)
- accepted_payment_rails (array, optional)
- block_rules (array, optional)
- guardrail_findings (array, optional)
- guardrail_passes (integer, optional)
- guardrail_warnings (integer, optional)
- max_daily_spend_usd (integer, optional)
- max_single_transaction_usd (integer, optional)
- max_tx_per_day (integer, optional)
- max_tx_per_min (integer, optional)
- overall_risk (string, optional)
- refund_posture (string, optional)
- retry_policy (string, optional)
- verdict (string, optional)
- verification_level (string, optional)

## Sample

```json
{
  "agent_types": [
    "openai"
  ],
  "verification_level": "ap2_vdc",
  "max_tx_per_min": 60,
  "max_tx_per_day": 5000,
  "max_single_val_usd": 100,
  "max_daily_val_usd": 1000,
  "rails": [
    "acp",
    "x402"
  ],
  "refund_posture": "standard",
  "retry_policy": "retry_1x",
  "block_rules": [
    "block_burst",
    "block_anon_high"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_agent_traffic_policy` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

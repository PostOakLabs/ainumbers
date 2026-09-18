# Agentic Checkout Protocol Selector

Scores ACP, UCP, x402, and Visa TAP against platform profile (buyer type, AOV, geography, stack capabilities) and returns a ranked protocol recommendation with fit scores. Node 1 of 3 in the Agentic Checkout Chain.

- Page: https://ainumbers.co/chaingraph/art-19-agentic-checkout-protocol-selector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-19-agentic-checkout-protocol-selector.md
- MCP tool: select_agentic_checkout_protocol (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_appetite (any, optional): type not evidenced by kernel source
- aov (any, optional): type not evidenced by kernel source
- buyer_type (any, optional): type not evidenced by kernel source
- geo (any, optional): type not evidenced by kernel source
- platform (any, optional): type not evidenced by kernel source
- stack_card (any, optional): type not evidenced by kernel source
- stack_crypto (any, optional): type not evidenced by kernel source
- tech_cap (any, optional): type not evidenced by kernel source

## Outputs

- primary_name (string, optional)
- primary_recommendation (string, optional)
- primary_score (integer, optional)
- profile (object, optional)
- protocol_scores (array, optional)
- recommended_protocols (array, optional)
- viable_protocols (array, optional)

## Sample

```json
{
  "platform": "custom",
  "buyer_type": "agent",
  "aov": "mid",
  "agent_appetite": "high",
  "geo": "global",
  "tech_cap": "api",
  "stack_card": false,
  "stack_crypto": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `select_agentic_checkout_protocol` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

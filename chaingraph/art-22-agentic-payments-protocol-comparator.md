# Agentic Payments Protocol Comparator

Compares AP2, ACP, x402, Visa TAP, Mastercard Agentic Token, and Tempo MPP (Machine Payments Protocol) across 8 dimensions (backer, artifact, signing, scope, rail, identity, audit, status) and 6 agentic scenarios. Root node of the Agentic Rail Chain: routing_policy output determines Branch A (AP2/card) or Branch B (A2A/x402). Promoted from T276.

- Page: https://ainumbers.co/chaingraph/art-22-agentic-payments-protocol-comparator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-22-agentic-payments-protocol-comparator.md
- MCP tool: compare_agentic_rail_protocols (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- protocols (array, required)
- scenario (unknown, optional)

## Outputs

- crosswalk (array, optional)
- note (string, optional)
- protocol_names (array, optional)
- protocols_compared (array, optional)
- protocols_detail (array, optional)
- recommendation (object, optional)
- scenario (string, optional)

## Sample

```json
{
  "protocols": [
    "ap2",
    "acp"
  ],
  "scenario": "cross_merchant"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_agentic_rail_protocols` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

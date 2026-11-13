# Card Data Flow Worksheet

A worksheet over declared inputs rather than a scope determination. You list system nodes (front end, back end, logs, analytics, a browser-automation provider, a payment service provider) with flags for what each handles: sees the raw card number, sees a token only, stores, logs, records sessions, has unrestricted connectivity to a card-number-handling component, could affect the security of one. The node sorts the declared nodes into four sets that mirror the wording of the PCI DSS v4.0.1 scope section (stores, processes or transmits card data; unrestricted connectivity to such a component; could impact its security; not placed by the declared inputs) and lists capture leaks: logs, session recordings and analytics captures that, by the declared inputs, record or log a system that sees the card number. It does not evaluate segmentation adequacy, does not read any network, and says nothing about whether any entity meets any requirement. Scope decisions stay with the entity and its assessor.

- Page: https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.html
- Markdown twin: https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.md
- MCP tool: map_card_data_flow_scope (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "components": [
    {
      "id": "web",
      "kind": "frontend",
      "sees_token_only": true
    },
    {
      "id": "api",
      "kind": "backend",
      "sees_token_only": true,
      "logs": true
    },
    {
      "id": "psp",
      "kind": "psp",
      "sees_raw_pan": true,
      "stores": true
    },
    {
      "id": "ana",
      "kind": "analytics",
      "captures_from": [
        "web"
      ],
      "records_sessions": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_card_data_flow_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

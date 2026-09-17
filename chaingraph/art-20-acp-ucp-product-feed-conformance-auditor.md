# ACP/UCP Product-Feed Conformance Auditor

Validates product/checkout/mandate JSON payloads against ACP or UCP field schemas (5 schema arrays). Identifies missing required fields, type mismatches, and unknown fields. Node 2 of 3 in the Agentic Checkout Chain.

- Page: https://ainumbers.co/chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.md
- MCP tool: audit_acp_ucp_product_feed (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- audit_target (unknown, optional)
- payload (unknown, required)
- payload_type (unknown, optional)
- strict (unknown, optional)

## Outputs

- acp_missing_required (array, optional)
- audit_target (string, optional)
- conformance_scores (object, optional)
- critical_gaps (integer, optional)
- payload_type (string, optional)
- ucp_missing_required (array, optional)
- verdict (string, optional)
- warnings (integer, optional)

## Sample

```json
{
  "payload": {
    "product_id": "p-001",
    "name": "Widget",
    "price": 9.99,
    "currency": "USD",
    "merchant_id": "m-001"
  },
  "payload_type": "product",
  "audit_target": "acp"
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_acp_ucp_product_feed` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

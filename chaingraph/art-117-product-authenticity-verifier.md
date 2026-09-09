# Luxury Goods Product Authenticity Verifier

Verify that presented lineage hashes chain back to the claimed root and that ownership transfers are continuous. Consumer/resale authenticity verdict: terminal stage of digital-product-passport-lineage chain.

- Page: https://ainumbers.co/chaingraph/art-117-product-authenticity-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-117-product-authenticity-verifier.md
- MCP tool: verify_product_authenticity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claimed_root_hash (unknown, optional)
- ownership_transfers (unknown, optional)
- presented_lineage_hashes (unknown, optional)
- product_id (unknown, optional)

## Outputs

- authentic (boolean, optional)
- chains_to_root (boolean, optional)
- ownership_continuous (boolean, optional)
- product_id (string, optional)

## Sample

```json
{
  "product_id": "GS1-DL-8712345678901",
  "claimed_root_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "presented_lineage_hashes": [
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  ],
  "ownership_transfers": [
    {
      "from": "manufacturer-A",
      "to": "distributor-B"
    },
    {
      "from": "distributor-B",
      "to": "retailer-C"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_product_authenticity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

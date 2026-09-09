# Digital Product Passport Cradle-to-Gate Lineage Builder

Build a cradle-to-gate supplier lineage with hash-only claims per stage (no trade secrets). Each stage carries a supplier_hash anchor, dataVersion-pinned certification, and carbon_value. Aggregates total carbon deterministically.

- Page: https://ainumbers.co/chaingraph/art-116-product-lineage-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-116-product-lineage-builder.md
- MCP tool: build_product_lineage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- product_id (unknown, optional)
- stages (unknown, optional)

## Outputs

- depth (integer, optional)
- lineage (array, optional)
- product_id (string, optional)
- total_carbon (number, optional)

## Sample

```json
{
  "product_id": "GS1-DL-8712345678901",
  "stages": [
    {
      "stage": "raw_material_extraction",
      "supplier_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "certification": "ISO14001",
      "dataVersion": "2026-01",
      "carbon_value": 5.2
    },
    {
      "stage": "manufacturing",
      "supplier_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "certification": "SA8000",
      "dataVersion": "2026-01",
      "carbon_value": 3.8
    },
    {
      "stage": "distribution",
      "supplier_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "certification": null,
      "dataVersion": "2026-01",
      "carbon_value": 1.4
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_product_lineage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

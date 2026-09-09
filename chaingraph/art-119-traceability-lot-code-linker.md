# FSMA 204 Traceability Lot Code Chain Linker

Link Traceability Lot Codes across CTEs and detect chain breaks. Transformation events mint a new TLC (recorded as new_lot_minted). Feeds the recall trace resolver (art-120).

- Page: https://ainumbers.co/chaingraph/art-119-traceability-lot-code-linker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-119-traceability-lot-code-linker.md
- MCP tool: link_traceability_lot_code (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- events (unknown, optional)

## Outputs

- breaks (array, optional)
- depth (integer, optional)
- lineage (array, optional)

## Sample

```json
{
  "events": [
    {
      "cte": "harvesting",
      "tlc": "TLC-001",
      "prev_tlc": null,
      "location_gln": "GLN-FARM",
      "date": "2026-05-01"
    },
    {
      "cte": "shipping",
      "tlc": "TLC-001",
      "prev_tlc": "TLC-001",
      "location_gln": "GLN-DC",
      "date": "2026-05-03"
    },
    {
      "cte": "receiving",
      "tlc": "TLC-001",
      "prev_tlc": "TLC-001",
      "location_gln": "GLN-STORE",
      "date": "2026-05-05"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `link_traceability_lot_code` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

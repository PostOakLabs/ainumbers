# FSMA 204 Recall Trace Resolver (24-Hour FDA List)

One-up/one-back trace from a contaminated Traceability Lot Code to affected recipients and sources. Emits the data for the FDA 24-hour sortable spreadsheet. Terminal stage of food-traceability-fsma204 chain.

- Page: https://ainumbers.co/chaingraph/art-120-recall-trace-resolver.html
- Markdown twin: https://ainumbers.co/chaingraph/art-120-recall-trace-resolver.md
- MCP tool: resolve_recall_trace (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- contaminated_tlc (unknown, optional)
- direction (unknown, optional)
- edges (unknown, optional)

## Outputs

- contaminated_tlc (string, optional)
- recipients (array, optional)
- sources (array, optional)
- traced_count (integer, optional)

## Sample

```json
{
  "contaminated_tlc": "TLC-CONTAM",
  "direction": "both",
  "edges": [
    {
      "from_tlc": "TLC-FARM-A",
      "to_tlc": "TLC-CONTAM",
      "from_gln": "GLN-001",
      "to_gln": "GLN-002",
      "date": "2026-05-01"
    },
    {
      "from_tlc": "TLC-CONTAM",
      "to_tlc": "TLC-STORE-1",
      "from_gln": "GLN-002",
      "to_gln": "GLN-003",
      "date": "2026-05-05"
    },
    {
      "from_tlc": "TLC-CONTAM",
      "to_tlc": "TLC-STORE-2",
      "from_gln": "GLN-002",
      "to_gln": "GLN-004",
      "date": "2026-05-06"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `resolve_recall_trace` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Reg Z Threshold Lookup

Reg Z version-pinned threshold lookup service. Tables: qm_points_fees, hoepa, hpml, card_penalty. 2021-2026 rows with Federal Register citations and effective dates. This node exists because agents reliably hallucinate current-year dollar thresholds. Annual refresh cadence with FR citation pinning. Covers CARD Act penalty fee note: the CFPB dollar-eight late-fee cap rule was vacated May 2025; prior safe-harbor amounts apply.

- Page: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.html
- Markdown twin: https://ainumbers.co/chaingraph/art-220-reg-z-threshold-lookup.md
- MCP tool: lookup_reg_z_thresholds (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- table (unknown, required)
- year (number, optional)

## Outputs

- available_years (array, optional)
- data (object, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- table (string, optional)
- year (integer, optional)

## Sample

```json
{
  "year": 2026,
  "table": "qm_points_fees"
}
```

## Verify

Run the sample policy_parameters through MCP tool `lookup_reg_z_thresholds` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

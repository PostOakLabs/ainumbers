# CNSA 2.0 Deadline Ladder Calculator

Per-row CNSA 2.0 post-quantum migration deadline for a supplied system inventory (system class, asset type, deployment date): applicable deadline, days remaining, the earliest binding constraint, and a FIPS 140-2 Historical-list exposure flag. Every deadline is declared with a source citation so a regulatory date shift is a data re-pin, not a code change. Structural date math only, findings asserted, not legal advice.

- Page: https://ainumbers.co/chaingraph/art-387-pqc-deadline-ladder-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-387-pqc-deadline-ladder-calculator.md
- MCP tool: compute_pqc_deadline_ladder (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inventory (array, required)
- policy_deadlines (unknown, required)
- reference_date (unknown, required)

## Outputs

- note (string, optional)
- policy_deadlines_used (object, optional)
- reference_date (string, optional)
- rows (array, optional)
- summary (object, optional)

## Sample

```json
{
  "reference_date": "2030-12-30",
  "inventory": [
    {
      "row_id": "KE-1",
      "system_class": "commercial-fin",
      "asset_type": "key-establishment",
      "deployment_date": "2024-01-01",
      "fips_140_2_certified": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_pqc_deadline_ladder` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

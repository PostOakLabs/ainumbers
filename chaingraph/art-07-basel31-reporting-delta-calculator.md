# Basel 3.1 Reporting Delta Calculator

Per-asset-class RWA delta (current vs Basel 3.1), output-floor binding analysis (72.5%), CET1 before/after, capital shortfall vs 12.5% total requirement. Six asset classes. Tornado chart. UK PRA PS1/26 go-live Jan 1, 2027.

- Page: https://ainumbers.co/chaingraph/art-07-basel31-reporting-delta-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-07-basel31-reporting-delta-calculator.md
- MCP tool: compute_basel31_delta (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_basel31_delta` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Taxonomy KPI & Green Asset Ratio Aggregator

Rolls activity-level Taxonomy alignment (from ART-73) into entity KPIs: revenue/CapEx/OpEx aligned proportions and, for financial undertakings, the Green Asset Ratio (GAR) per the Disclosures Delegated Act denominator rules.

- Page: https://ainumbers.co/chaingraph/art-74-taxonomy-kpi-gar-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-74-taxonomy-kpi-gar-aggregator.md
- MCP tool: aggregate_taxonomy_kpi_gar (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- activities (unknown, optional)
- covered_assets (unknown, optional)
- entity_type (unknown, optional)
- gar_numerator_items (unknown, optional)
- total_assets (unknown, optional)

## Outputs

- activity_count (integer, optional)
- aligned_count (integer, optional)
- capex_aligned_pct (integer, optional)
- entity_type (string, optional)
- gar_detail (string, optional)
- green_asset_ratio (string, optional)
- kpi_breakdown (array, optional)
- note (string, optional)
- opex_aligned_pct (integer, optional)
- reference (object, optional)
- revenue_aligned_pct (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_taxonomy_kpi_gar` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

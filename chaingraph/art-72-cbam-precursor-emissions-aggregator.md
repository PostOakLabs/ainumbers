# CBAM Precursor-Emissions Aggregator

Rolls up embedded emissions across precursors in a steel/aluminium value chain (incl. the 2028 pre-consumer-scrap rule) so a producer can supply complex-goods emissions to its importer. Pre-positions the downstream-180 scope extension (Council position 12 Jun 2026, application 1 Jan 2028).

- Page: https://ainumbers.co/chaingraph/art-72-cbam-precursor-emissions-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-72-cbam-precursor-emissions-aggregator.md
- MCP tool: aggregate_cbam_precursor_emissions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- final_good (unknown, optional)
- precursors (unknown, optional)
- scrap_input_share (unknown, optional)

## Outputs

- cumulative_see_tco2e (integer, optional)
- data_quality_grade (string, optional)
- note (string, optional)
- precursor_breakdown (array, optional)
- quantity_tonnes (integer, optional)
- scrap_adjustment (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_cbam_precursor_emissions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Climate Scenario Applicator (NGFS / Fit-for-55)

Applies a climate scenario path (NGFS Phase V orderly/disorderly/hot-house, Fit-for-55 supervisory; reference_version NGFS-Phase-V-2025) to an exposure set, emitting stress-adjusted metrics for a bank/insurer climate-risk file. Scenario paths are versioned reference data, not the suite financial-shock stress parameters.

- Page: https://ainumbers.co/chaingraph/art-76-climate-scenario-applicator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-76-climate-scenario-applicator.md
- MCP tool: apply_climate_scenario (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exposures (unknown, optional)
- metric (unknown, optional)
- scenario (unknown, optional)

## Outputs

- baseline_metric (integer, optional)
- carbon_price_assumption (integer, optional)
- delta (integer, optional)
- delta_by_sector (array, optional)
- delta_pct (integer, optional)
- gdp_delta_at_horizon (number, optional)
- horizon (integer, optional)
- metric (string, optional)
- note (string, optional)
- reference (object, optional)
- scenario_family (string, optional)
- scenario_label (string, optional)
- stressed_metric (integer, optional)
- transition_intensity (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `apply_climate_scenario` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# IRRBB EVE Shock Calculator

Calculate Delta Economic Value of Equity (EVE) under the 6 BCBS d368 / EBA standardised IRRBB shock scenarios (parallel up, parallel down, short up, short down, steepener, flattener), recalibrated effective 1 Jan 2026. Duration-based sensitivity over 6 standardised repricing time buckets using a 200bp reference parallel shock and the BCBS d368 Annex 2 short/long tenor scalars. Returns per-scenario delta_eve, worst_scenario, and worst_delta_eve. Root node of the irrbb-supervisory-outlier-test chain. BCBS d368 (2024 recalibration). NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-183-irrbb-eve-shock-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-183-irrbb-eve-shock-calculator.md
- MCP tool: calculate_irrbb_eve_shocks (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- repricing_gaps (unknown, optional)

## Outputs

- buckets_used (array, optional)
- reference_parallel_shock_bps (integer, optional)
- shocks (object, optional)
- total_net_gap (integer, optional)
- worst_delta_eve (number, optional)
- worst_scenario (string, optional)

## Sample

```json
{
  "repricing_gaps": {
    "on_1m": 500,
    "m1_y1": 800,
    "y1_y3": -300,
    "y3_y5": 1200,
    "y5_y10": -400,
    "y10_plus": 200
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_irrbb_eve_shocks` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

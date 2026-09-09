# Rate Shock Ladder Replay

US OCC/FDIC interest-rate-risk parallel shock ladder: sweeps four prescribed parallel magnitudes (+/-100/200/300/400bp) over a bucketed repricing-gap schedule, returning both a duration-weighted delta-EVE leg and a 12-month cumulative-gap delta-NII leg per shock. Optional non-parallel steepener/flattener presets are caller-declared (short/long tenor bps split), not baked-in regulatory scalars. Distinct from the shipped BCBS d368 / EBA standardised six-scenario convention (art-183/art-185): sweeps multiple magnitudes rather than one, and combines EVE+NII in a single kernel. Complements CC-A repricing-gap schedules or user-supplied gap tables. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-369-run-rate-shock-ladder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-369-run-rate-shock-ladder.md
- MCP tool: run_rate_shock_ladder (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- nii_12m_gap (unknown, required)
- repricing_gaps (unknown, optional)
- shock_presets (array, required)

## Outputs

- buckets_used (array, optional)
- convention (string, optional)
- ladder (object, optional)
- magnitudes_bps (array, optional)
- nii_12m_gap (integer, optional)
- preset_shocks (object, optional)
- total_net_gap (integer, optional)
- worst_delta_eve (integer, optional)
- worst_scenario (string, optional)

## Sample

```json
{
  "repricing_gaps": {
    "on_1m": 100000,
    "m1_y1": 250000,
    "y1_y3": -150000,
    "y3_y5": 200000,
    "y5_y10": -50000,
    "y10_plus": 150000
  },
  "nii_12m_gap": 300000,
  "shock_presets": [
    {
      "name": "steepener",
      "short_bps": -50,
      "long_bps": 100
    },
    {
      "name": "flattener",
      "short_bps": 100,
      "long_bps": -50
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_rate_shock_ladder` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

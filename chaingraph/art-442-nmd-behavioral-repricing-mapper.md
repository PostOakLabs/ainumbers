# NMD Behavioral Repricing Mapper

OCC 2010-1 Interagency Advisory on IRR: maps non-maturity deposit (NMD) segment balances into a bucketed net-repricing-gap schedule using a caller-declared behavioral allocation (per-bucket repricing fractions) and a deposit beta - never a baked-in regulatory decay curve. Feeds directly into art-369's repricing_gaps input, which art-369 itself requires as a GIVEN and does not derive. Distinct from art-369 (Rate Shock Ladder Replay), which sweeps shocks over an already-bucketed gap schedule; this kernel builds that schedule from underlying deposit balances. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-442-nmd-behavioral-repricing-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-442-nmd-behavioral-repricing-mapper.md
- MCP tool: map_nmd_behavioral_repricing (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- nmd_segments (array, required)

## Outputs

- buckets_used (array, optional)
- convention (string, optional)
- net_repricing_gap (object, optional)
- segment_results (array, optional)
- total_balance (integer, optional)
- total_net_repricing_gap (integer, optional)
- total_rate_sensitive_balance (integer, optional)
- weighted_avg_beta (number, optional)

## Sample

```json
{
  "nmd_segments": [
    {
      "name": "checking_core",
      "balance": 1000000,
      "beta": 0.2,
      "allocation": {
        "on_1m": 0,
        "m1_y1": 0,
        "y1_y3": 0.1,
        "y3_y5": 0.2,
        "y5_y10": 0.3,
        "y10_plus": 0.4
      }
    },
    {
      "name": "savings_volatile",
      "balance": 500000,
      "beta": 0.6,
      "allocation": {
        "on_1m": 0.5,
        "m1_y1": 0.5,
        "y1_y3": 0,
        "y3_y5": 0,
        "y5_y10": 0,
        "y10_plus": 0
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_nmd_behavioral_repricing` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

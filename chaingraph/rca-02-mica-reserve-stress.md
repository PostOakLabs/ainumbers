# MiCA Stablecoin Reserve Stress Simulator

Monte Carlo simulation of stablecoin reserve portfolios under MiCA Article 36 redemption stress and asset price shocks. 1,000 paths × 90-day horizon. Coverage ratio fan chart (P5–P95), breach probability curve, Article 36 liquid buffer analysis, fire-sale contagion estimate. Complements ART-06 (static attestation) with full stochastic dimension.

- Page: https://ainumbers.co/chaingraph/rca-02-mica-reserve-stress.html
- Markdown twin: https://ainumbers.co/chaingraph/rca-02-mica-reserve-stress.md
- MCP tool: simulate_stablecoin_reserve (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- art36_buffer (unknown, optional)
- horizon_days (unknown, optional): Duration in days
- n_paths (number, optional)
- reserve_ratio_init (unknown, optional)
- scenario (unknown, optional)
- seed (unknown, optional)

## Outputs

- art36_buffer_adequate_pct (integer, optional)
- breach_probability_pct (integer, optional)
- compliance_flags (array, optional)
- coverage_p50_end_day (number, optional)
- coverage_p5_end_day (number, optional)
- horizon_days (integer, optional)
- n_paths (integer, optional)
- peak_breach_pct (integer, optional)
- scenario (string, optional)
- verdict (string, optional)
- warnings (array, optional)

## Sample

```json
{
  "n_paths": 50,
  "horizon_days": 2,
  "seed": 42
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_stablecoin_reserve` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Cash Forecast Accuracy Scoring

Scores treasury cash forecast accuracy per AFP Cash Forecasting Survey 2024 benchmarks. Computes MAPE and directional bias across T+1/T+7/T+30/T+90+ horizon buckets. Detects persistent timing bias (>75% same-sign errors over >=4 observations). Returns overall_accuracy_tier (EXCELLENT <5% / GOOD 5-10% / ACCEPTABLE 10-20% / POOR >20%), by_horizon breakdown, and timing_bias_detected. ZERO PII: aggregate monetary amounts only, no account-holder identifiers.

- Page: https://ainumbers.co/chaingraph/art-263-score-cash-forecast-accuracy.html
- Markdown twin: https://ainumbers.co/chaingraph/art-263-score-cash-forecast-accuracy.md
- MCP tool: score_cash_forecast_accuracy (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- forecasts (array, required)

## Outputs

- afp_benchmark_tiers (string, optional)
- by_horizon (object, optional)
- not_legal_advice (string, optional)
- overall_accuracy_tier (string, optional)
- overall_bias_pct (integer, optional)
- overall_mape_pct (integer, optional)
- persistent_sign_periods (integer, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- skipped_zero_actual (integer, optional)
- table_source (string, optional)
- table_version (string, optional)
- timing_bias_detected (boolean, optional)
- total_observations (integer, optional)

## Sample

```json
{
  "forecasts": [
    {
      "actual_amount": 1000000,
      "forecast_amount": 1020000,
      "horizon_days": 1
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_cash_forecast_accuracy` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

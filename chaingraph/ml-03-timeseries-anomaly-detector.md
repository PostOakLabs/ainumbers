# Time-Series Anomaly Detector

Rolling-window z-score and STL-style seasonal decomposition anomaly detection on synthetic payment volume time series. Control chart (UCL/LCL 3σ), trend/seasonal/residual panel decomposition, anomaly flag table with severity, naïve ARIMA-lite 30-period forecast. Chains from SIM-03 (Basel RWA Scenario Modeler). Feeds RCA-01 (FRTB IMA). DORA Art.17 monitoring / EBA GL/2021/03 operational risk / PSD2 Art.96 fraud reporting.

- Page: https://ainumbers.co/chaingraph/ml-03-timeseries-anomaly-detector.html
- Markdown twin: https://ainumbers.co/chaingraph/ml-03-timeseries-anomaly-detector.md
- MCP tool: detect_timeseries_anomalies (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- nAnomalies (number, required)
- nPeriods (number, required)
- seasonPeriod (number, required)
- seed (number, required)
- trendType (unknown, required)
- windowSize (number, required)
- zThreshold (number, required)

## Outputs

- anomalies_flagged (integer, optional)
- flag_rate (number, optional)
- flagged_periods (array, optional)
- high_severity_flags (integer, optional)
- max_abs_z_score (number, optional)
- medium_severity_flags (integer, optional)
- n_periods (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "nPeriods": 90,
  "seasonPeriod": 7,
  "windowSize": 14,
  "zThreshold": 3,
  "nAnomalies": 2,
  "trendType": "flat",
  "seed": 42
}
```

## Verify

Run the sample policy_parameters through MCP tool `detect_timeseries_anomalies` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

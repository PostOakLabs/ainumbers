# Model Outcome-Analysis Comparison

SR 26-2 ongoing-monitoring backtest: compares a list of period predicted-vs-actual model outcomes, computes per-period absolute percent error, mean/max absolute percent error, and flags periods breaching a caller-declared error tolerance. Returns a pass/fail outcome status against a caller-declared maximum breach rate. Second node in the model-passport lifecycle (after art-450 inventory entry, before art-453 validation status). Distinct from the shipped program-level gap analyzers (tools 339/451 SR 26-02 and SR 11-7 gap assessors), which score an institution's overall MRM program rather than backtest one model's outcomes. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-451-model-outcome-analysis.html
- Markdown twin: https://ainumbers.co/chaingraph/art-451-model-outcome-analysis.md
- MCP tool: compare_model_outcome_analysis (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- error_threshold_pct (unknown, required): Percentage value
- max_breach_rate_pct (unknown, required): Percentage value
- observations (array, required)

## Outputs

- breach_periods (array, optional)
- breach_rate_pct (integer, optional)
- error_threshold_pct (integer, optional)
- max_absolute_percent_error (integer, optional)
- max_breach_rate_pct (integer, optional)
- mean_absolute_percent_error (integer, optional)
- outcome_status (string, optional)
- periods (array, optional)
- total_periods (integer, optional)
- worst_period (string, optional)

## Sample

```json
{
  "observations": [
    {
      "period_label": "Q1",
      "predicted": 1000,
      "actual": 1020
    },
    {
      "period_label": "Q2",
      "predicted": 1000,
      "actual": 1150
    },
    {
      "period_label": "Q3",
      "predicted": 1000,
      "actual": 980
    },
    {
      "period_label": "Q4",
      "predicted": 1000,
      "actual": 1050
    }
  ],
  "error_threshold_pct": 10,
  "max_breach_rate_pct": 20
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_model_outcome_analysis` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

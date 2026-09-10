# Isolation Forest Transaction Anomaly Detector

Native-JS Isolation Forest anomaly detection on synthetic transaction batches. 10-tree forest, 4-feature scoring (amount, hour, counterparty frequency, recency), anomaly score histogram, flagged transaction table. Zero-egress: no real transaction data transmitted. Chains from ART-05 (EU AI Act credit-scoring) and ART-10 (AMLA typology).

- Page: https://ainumbers.co/chaingraph/ml-01-isolation-forest.html
- Markdown twin: https://ainumbers.co/chaingraph/ml-01-isolation-forest.md
- MCP tool: detect_transaction_anomalies (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- contamination_rate (number, required)
- n_transactions (number, required)
- n_trees (number, required)
- seed (number, required)
- subsample_size (number, required)
- threshold (number, required)

## Outputs

- flag_rate (number, optional)
- flagged_count (integer, optional)
- max_anomaly_score (number, optional)
- mean_anomaly_score (number, optional)
- n_transactions_scored (integer, optional)
- p95_anomaly_score (number, optional)
- threshold (number, optional)
- verdict (string, optional)

## Sample

```json
{
  "n_transactions": 32,
  "contamination_rate": 0.05,
  "seed": 42,
  "n_trees": 2,
  "subsample_size": 16,
  "threshold": 0.6
}
```

## Verify

Run the sample policy_parameters through MCP tool `detect_transaction_anomalies` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

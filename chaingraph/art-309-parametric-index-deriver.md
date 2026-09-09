# Parametric Index Deriver

Deterministically aggregates a named metric (mean, sum, count, max, or min) across a receipt set into a parametric index value: receipts as an oracle replacement, replay-on-challenge instead of trust-the-feed. Feeds the shipped compute_parametric_trigger_payout kernel, which performs the actual trigger-vs-payout math; this kernel never reimplements that logic. The index is a replayable derived value, never a settlement trigger by itself. Not the same as check_agency_eligibility_matrix or any lending eligibility tool - this is an insurance-evidence parametric index. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-309-parametric-index-deriver.html
- Markdown twin: https://ainumbers.co/chaingraph/art-309-parametric-index-deriver.md
- MCP tool: derive_parametric_index_from_receipts (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- index_def (unknown, required)
- receipts (unknown, required)

## Outputs

- aggregation (string, optional)
- contributing_receipts (integer, optional)
- index_value (integer, optional)
- insufficient_evidence (boolean, optional)
- metric (string, optional)
- window (object, optional)

## Sample

```json
{
  "receipts": [
    {
      "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "measured_metric": 10
    },
    {
      "receipt_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "measured_metric": 20
    },
    {
      "receipt_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "measured_metric": 30
    }
  ],
  "index_def": {
    "metric": "wind_speed_mph",
    "aggregation": "mean",
    "window": {
      "from": "2026-08-01",
      "to": "2026-08-31"
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `derive_parametric_index_from_receipts` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

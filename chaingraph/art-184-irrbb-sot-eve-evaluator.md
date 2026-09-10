# IRRBB SOT EVE Evaluator

Evaluate the EBA Supervisory Outlier Test (SOT) on Economic Value of Equity: the worst-case delta EVE decline across the 6 standardised shock scenarios versus the EU-wide hard threshold of 15% of Tier 1 capital (EBA RTS on the SOT / EBA Guidelines on IRRBB and CSRBB, EBA/GL/2022/14). Returns delta_eve_pct_of_tier1 and eve_outlier. Section 16 proof candidate. Second node of the irrbb-supervisory-outlier-test chain. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-184-irrbb-sot-eve-evaluator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-184-irrbb-sot-eve-evaluator.md
- MCP tool: evaluate_irrbb_sot_eve (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- capital (unknown, optional)
- eve_shock (unknown, optional)

## Outputs

- delta_eve_pct_of_tier1 (integer, optional)
- eve_outlier (boolean, optional)
- sot_eve_threshold_pct (integer, optional)
- tier1_capital (integer, optional)
- worst_delta_eve (integer, optional)

## Sample

```json
{
  "eve_shock": {
    "worst_delta_eve": -180
  },
  "capital": {
    "tier1_capital": 1000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `evaluate_irrbb_sot_eve` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

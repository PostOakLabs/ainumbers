# Basel 2023-vs-2026 Capital-Delta Comparator

Runs the same portfolio through the 2023 Basel III Endgame NPR risk-weight framework and the 2026 reproposal (2026-03-19, three NPRs) framework, then reports the RWA and minimum-capital delta - the 'reproduce the $87.7bn relief story on OUR book' tool. Representative credit-risk asset-class risk-weight buckets plus a simplified operational-risk SMA business-indicator coefficient, NOT an exhaustive regulatory table. rule_status:'proposed' - final rule expected ~Q4 2026, re-pin WU pre-authorized at finalization. References compute_rwa_erba_2026 (art-355) and compute_oprisk_sma_2026 (art-356) by tool_id for future chain wiring.

- Page: https://ainumbers.co/chaingraph/art-357-basel-2023-vs-2026-capital-delta-comparator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-357-basel-2023-vs-2026-capital-delta-comparator.md
- MCP tool: compare_basel_2023_vs_2026 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- business_indicator (unknown, required)
- exposures (array, required)

## Outputs

- business_indicator (integer, optional)
- constants_version (string, optional)
- credit_rwa_2023 (integer, optional)
- credit_rwa_2026 (integer, optional)
- delta_capital (integer, optional)
- delta_capital_pct (number, optional)
- delta_rwa (integer, optional)
- direction (string, optional)
- disambiguation (string, optional)
- op_capital_2023 (integer, optional)
- op_capital_2026 (integer, optional)
- op_rwa_2023 (integer, optional)
- op_rwa_2026 (integer, optional)
- portfolio_summary (array, optional)
- referenced_tool_ids (object, optional)
- rule_status (string, optional)
- source (string, optional)
- total_capital_2023 (integer, optional)
- total_capital_2026 (integer, optional)
- total_rwa_2023 (integer, optional)
- total_rwa_2026 (integer, optional)
- unrecognized_asset_class (boolean, optional)

## Sample

```json
{
  "exposures": [
    {
      "asset_class": "residential_mortgage_low_ltv",
      "amount": 5000000
    },
    {
      "asset_class": "corporate_investment_grade",
      "amount": 3000000
    },
    {
      "asset_class": "retail_other",
      "amount": 2000000
    },
    {
      "asset_class": "off_balance_sheet_commitment",
      "amount": 1000000
    }
  ],
  "business_indicator": 800000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_basel_2023_vs_2026` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

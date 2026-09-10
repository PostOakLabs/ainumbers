# Settlement-Risk Capital Efficiency Optimizer

Quantify RWA and capital savings from moving to Canton atomic DvP. Outputs bps-of-notional saved per year under BCBS CRE70/CRE52 SA-CCR. Stage 2 of the Canton Capital Efficiency chain.

- Page: https://ainumbers.co/tools/504-settlement-risk-capital-optimizer.html
- Markdown twin: https://ainumbers.co/tools/504-settlement-risk-capital-optimizer.md
- MCP tool: optimize_settlement_capital (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cet1_ratio (number, required)
- cost_of_capital (number, required)
- positions (array, required)

## Outputs

- cet1_ratio (number, required)
- cost_of_capital (number, required)
- portfolio_bps (number, required)
- rows (array, required)
- total_annual_saving (number, required)
- total_capital_freed (number, required)
- total_notional_usd (number, required)
- total_rwa_delta_usd (number, required)
- verdict (string, required)

## Sample

```json
{
  "positions": [
    {
      "instrument": "IR Swap 5Y",
      "notional_usd": 10000000,
      "rating": "aaa",
      "settlement_type": "t0"
    }
  ],
  "cet1_ratio": 0.125,
  "cost_of_capital": 0.1
}
```

## Verify

Run the sample policy_parameters through MCP tool `optimize_settlement_capital` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

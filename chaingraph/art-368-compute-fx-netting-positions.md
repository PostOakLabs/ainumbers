# Multilateral FX Netting Calculator

Multilateral FX netting across up to 8 currencies: nets each currency's payable/receivable exposures in FCY, converts to USD at a caller-supplied spot-plus-forward-points effective rate, and returns gross volume, net volume, netting efficiency, estimated settlement savings, and per-currency residual position with an approximate 95%-confidence VaR. Ports the calculation from tools/105-fx-netting-simulator.html into a provable kernel. Spot rates, forward points, and 30-day volatility are caller-supplied reference data, never vendored.

- Page: https://ainumbers.co/chaingraph/art-368-compute-fx-netting-positions.html
- Markdown twin: https://ainumbers.co/chaingraph/art-368-compute-fx-netting-positions.md
- MCP tool: compute_fx_netting_positions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- positions (array, required)

## Outputs

- currency_count (integer, optional)
- estimated_settlement_savings_usd (integer, optional)
- gross_volume_usd (integer, optional)
- net_volume_usd (integer, optional)
- netting_efficiency_pct (number, optional)
- positions (array, optional)
- regulatory_basis (string, optional)

## Sample

```json
{
  "positions": [
    {
      "ccy": "EUR",
      "pay": 850000,
      "rec": 620000,
      "spot": 1.085,
      "fwd_bps": 0,
      "vol_30d": 0.032
    },
    {
      "ccy": "GBP",
      "pay": 420000,
      "rec": 580000,
      "spot": 1.265,
      "fwd_bps": 0,
      "vol_30d": 0.038
    },
    {
      "ccy": "JPY",
      "pay": 95000000,
      "rec": 72000000,
      "spot": 0.00665,
      "fwd_bps": 0,
      "vol_30d": 0.041
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_fx_netting_positions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

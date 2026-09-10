# Net Present Value (NPV)

Net present value of a cash flow series, discounted at a declared periodic rate. Accepts either caller-supplied period offsets or dated cash flows converted to years under a declared day-count convention (30/360, ACT/360, ACT/365, or a simplified ACT/ACT). Deterministic pow via Taylor-series exp/ln, no engine transcendentals. Foundation primitive for downstream valuation and lease/loan analytics.

- Page: https://ainumbers.co/chaingraph/art-324-tvm-npv.html
- Markdown twin: https://ainumbers.co/chaingraph/art-324-tvm-npv.md
- MCP tool: compute_npv (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cash_flows (array, required)
- day_count_convention (unknown, required)
- discount_rate_pct (number, optional): Percentage value
- mode (unknown, required)
- valuation_date (unknown, required)

## Outputs

- day_count_convention (string, optional)
- discount_rate_pct (integer, optional)
- mode (string, optional)
- note (string, optional)
- npv (number, optional)
- num_cash_flows (integer, optional)
- regulatory_basis (string, optional)
- total_undiscounted (integer, optional)

## Sample

```json
{
  "mode": "periods",
  "cash_flows": [
    {
      "amount": -1000,
      "t": 0
    },
    {
      "amount": 400,
      "t": 1
    },
    {
      "amount": 400,
      "t": 2
    },
    {
      "amount": 400,
      "t": 3
    }
  ],
  "discount_rate_pct": 10
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_npv` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Bond Macaulay / Modified Duration

Macaulay and modified duration for a standard even-period bullet bond, given face value, coupon rate, yield to maturity, years to maturity, and compounding frequency. Prices the schedule and reports the PV-weighted average time to cash flows in years. Feeds compute_dv01 and compute_convexity for full fixed-income risk analytics.

- Page: https://ainumbers.co/chaingraph/art-329-tvm-bond-duration.html
- Markdown twin: https://ainumbers.co/chaingraph/art-329-tvm-bond-duration.md
- MCP tool: compute_bond_duration (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- coupon_rate_pct (number, optional): Percentage value
- day_count_convention (unknown, required)
- face_value (number, optional)
- periods_per_year (number, optional)
- years_to_maturity (number, optional)
- ytm_pct (number, optional): Percentage value

## Outputs

- coupon_rate_pct (integer, optional)
- day_count_convention (string, optional)
- face_value (integer, optional)
- macaulay_duration_years (number, optional)
- modified_duration_years (number, optional)
- note (string, optional)
- num_periods (integer, optional)
- periods_per_year (integer, optional)
- price (number, optional)
- regulatory_basis (string, optional)
- years_to_maturity (integer, optional)
- ytm_pct (integer, optional)

## Sample

```json
{
  "face_value": 1000,
  "coupon_rate_pct": 6,
  "ytm_pct": 8,
  "years_to_maturity": 5,
  "periods_per_year": 2
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_bond_duration` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

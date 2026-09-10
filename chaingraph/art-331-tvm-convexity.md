# Bond Convexity

Standard closed-form convexity for a bullet bond, annualized by compounding frequency squared. Second-order complement to modified duration for estimating bond price sensitivity to larger yield moves; optionally reports the convexity price-adjustment term for a declared yield shock. Same bond schedule builder as compute_bond_duration.

- Page: https://ainumbers.co/chaingraph/art-331-tvm-convexity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-331-tvm-convexity.md
- MCP tool: compute_convexity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- coupon_rate_pct (number, optional): Percentage value
- face_value (number, optional)
- periods_per_year (number, optional)
- years_to_maturity (number, optional)
- yield_shock_bp (number, optional)
- ytm_pct (number, optional): Percentage value

## Outputs

- convexity (number, optional)
- convexity_price_adjustment_pct (string, optional)
- coupon_rate_pct (integer, optional)
- face_value (integer, optional)
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

Run the sample policy_parameters through MCP tool `compute_convexity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

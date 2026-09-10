# Bond DV01 (Price Value of a Basis Point)

DV01 / price value of a basis point for a standard even-period bullet bond, computed by full central-difference reprice at yield plus and minus a declared basis-point shock, not the linear modified-duration approximation. Stays accurate for large coupons or short maturities where the linear approximation drifts. Same bond schedule builder as compute_bond_duration.

- Page: https://ainumbers.co/chaingraph/art-330-tvm-dv01.html
- Markdown twin: https://ainumbers.co/chaingraph/art-330-tvm-dv01.md
- MCP tool: compute_dv01 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- basis_points (number, optional)
- coupon_rate_pct (number, optional): Percentage value
- face_value (number, optional)
- periods_per_year (number, optional)
- years_to_maturity (number, optional)
- ytm_pct (number, optional): Percentage value

## Outputs

- coupon_rate_pct (integer, optional)
- dv01 (number, optional)
- face_value (integer, optional)
- method (string, optional)
- note (string, optional)
- periods_per_year (integer, optional)
- price (number, optional)
- price_down_shock (number, optional)
- price_up_shock (number, optional)
- regulatory_basis (string, optional)
- shock_size_bp (integer, optional)
- years_to_maturity (integer, optional)
- ytm_pct (integer, optional)

## Sample

```json
{
  "face_value": 1000,
  "coupon_rate_pct": 6,
  "ytm_pct": 8,
  "years_to_maturity": 5,
  "periods_per_year": 2,
  "basis_points": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_dv01` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

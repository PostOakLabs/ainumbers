# Bond Ladder Builder

Builds a target-weight bond ladder from a total notional split across maturity rungs and reports rung-by-rung and portfolio risk analytics: each rung's price, Macaulay and modified duration, DV01 and convexity (the same formulas as compute_bond_duration, compute_dv01 and compute_convexity applied at each rung's notional), plus the target_weight-weighted portfolio aggregates. Every reinvestment assumption is named in plain sentences in the output: hold_to_maturity (cash held at 0%) or roll_to_longest_rung (coupons and maturing principal reinvested at the longest rung's yield), and rung target weights must sum to 1 within 1e-9 or the tool refuses, naming the sum. Exclusions: no credit spread, no call features, flat yield per rung, no live data.

- Page: https://ainumbers.co/chaingraph/art-705-bond-ladder-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-705-bond-ladder-builder.md
- MCP tool: build_bond_ladder (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- notional (number, required): Total ladder notional, split across rungs pro rata to target_weight.
- rungs (array, required): One object per rung: { maturity_years, coupon_rate_pct, yield_pct, target_weight }. Target weights must sum to 1 within 1e-9.
- periods_per_year (number, optional): Coupon periods per year for every rung (default 2).
- reinvestment_assumption (string, optional): Named in the output assumptions[]: hold coupons and maturing principal as cash at 0%, or reinvest them at the longest rung's yield.

## Outputs

- assumptions (array, required)
- detail (string, optional)
- domain_errors (array, optional)
- error (string, optional)
- ladder (array,null, required)
- note (string, optional)
- notional (number, optional)
- num_rungs (number, optional)
- periods_per_year (number, optional)
- portfolio (object,null, required)
- regulatory_basis (string, optional)
- reinvestment_assumption (string, optional)

## Sample

```json
{
  "notional": 100000,
  "periods_per_year": 2,
  "reinvestment_assumption": "hold_to_maturity",
  "rungs": [
    {
      "maturity_years": 5,
      "coupon_rate_pct": 4.5,
      "yield_pct": 4.2,
      "target_weight": 1
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_bond_ladder` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Runway Goal Path

Goal-seek over a fixed monthly startup cash model: the smallest change in price, in month-over-month revenue growth, or in burn that reaches a declared goal, ranked by least effort. The model walks a finite horizon of integer months: revenue starts at the declared base, optionally price-uplifted, and grows at a constant month-over-month rate from month 2; burn is derived once and held constant; cash accumulates net each month, and the first month where cash goes below zero is the cash-out month, interpolated in basis points of a month as (m-1)*10000 + floor(prev_cash*10000/(-net)) with cash landing exactly on zero not counting as a cash-out. Four goal types are declared: a runway of at least N months (the cash-out month in basis points of a month reaches N*10000, or the company stays solvent through the horizon), solvency through the horizon, breakeven (revenue at or above burn) by a month, or ending cash of at least an amount. A grid search walks every combination of the three declared lever grids, keeps the scenarios that meet the goal, and ranks them by effort ascending, where effort is the half-up integer division by 100 of the sum of weight times lever, ties breaking by burn_cut, then price_uplift, then growth_add, all ascending; the all-zero lever scenario is always evaluated and reported as the baseline with baseline_meets_goal. All money is an integer count of minor units and all rates are integer basis points; rounding is half-up, applied once per month step for revenue and once per scenario for burn. Out-of-domain input is refused with a named reason, never rounded or coerced: non-integer or negative money, a growth rate below -10000 basis points, a horizon outside 1-60 months, an unknown goal type, a non-integer goal value, a lever grid unsorted, negative, or holding more than 12 values, non-integer or negative effort weights, or a max_candidates below one. Scope limits: one revenue line, constant burn, no financing events, no churn model, and no tax.

- Page: https://ainumbers.co/chaingraph/art-702-runway-goal-path.html
- Markdown twin: https://ainumbers.co/chaingraph/art-702-runway-goal-path.md
- MCP tool: find_runway_goal_path (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cash_minor (integer, required)
- monthly_revenue_minor (integer, required)
- monthly_burn_minor (integer, required)
- revenue_growth_bp (integer, required)
- horizon_months (integer, required)
- goal (object, required)
- levers (object, required)
- effort_weights (object, required)
- max_candidates (integer, required)

## Outputs

- baseline (object,null, optional)
- baseline_meets_goal (boolean, optional)
- candidates (array, optional)
- scenarios_evaluated (integer, optional)
- none_found_reason (string,null, optional)
- refusal_reason (string, optional)
- domain_errors (array, optional)
- scope_note (string, optional)

## Sample

```json
{
  "cash_minor": 100000000,
  "monthly_revenue_minor": 2000000,
  "monthly_burn_minor": 6000000,
  "revenue_growth_bp": 800,
  "horizon_months": 36,
  "goal": {
    "type": "runway_months",
    "value": 18
  },
  "levers": {
    "price_uplift_bp": [
      0,
      500,
      1000,
      1500,
      2000,
      3000
    ],
    "growth_add_bp": [
      0,
      100,
      200,
      300,
      500
    ],
    "burn_cut_bp": [
      0,
      500,
      1000,
      1500,
      2000,
      3000
    ]
  },
  "effort_weights": {
    "price_uplift_bp": 1,
    "growth_add_bp": 2,
    "burn_cut_bp": 1
  },
  "max_candidates": 4
}
```

## Verify

Run the sample policy_parameters through MCP tool `find_runway_goal_path` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

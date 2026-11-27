# Automation Payback

Automation Payback ranker ported from ApexLogics Apex #180 (AL-194). For a list of automation candidates (hours saved per week, loaded hourly rate, error cost avoided per month, one-time build cost, monthly subscription) and three global policy parameters (maintenance haircut percent on recurring cost, evaluation horizon in months, weeks per month), the node computes each candidate's monthly reclaimable value and total cost of ownership (subscription with haircut plus straight-line amortised build), ranks candidates by descending net monthly dollars with ties preserving input order, assigns BUILD or SKIP at net >= 0, derives break-even months as build cost over the positive monthly margin excluding amortisation, and returns portfolio totals (net dollars kept and all-in, hours reclaimed over BUILD rows, horizon net), the best candidate, the fastest break-even, and an ALL_CLEAR / MIXED_LIST / NO_CANDIDATE_CLEARS verdict with an empty-list guard. Gross-dollar arithmetic over user estimates; the 20 percent haircut and the 4.33 weeks-per-month default are policy parameters kept for live-vector parity (the 52/12 quotient is UNGROUNDED), with no tax or regulatory premise (payload DIFFERS.md D-01..D-06, CITES.md).

- Page: https://ainumbers.co/chaingraph/art-771-automation-payback.html
- Markdown twin: https://ainumbers.co/chaingraph/art-771-automation-payback.md
- MCP tool: compute_automation_payback (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, optional): Explicit as-of date YYYY-MM-DD. The kernel reads no clock.
- maintenance_haircut_pct (number, required): Policy parameter: uplift on the monthly subscription only. Floored at 0.
- horizon_months (number, required): Evaluation horizon in whole months, rounded half-up, floored at 1.
- weeks_per_month (number, required): Policy parameter: hours-per-week to hours-per-month. Floored at 1.
- candidates (array, required): One entry per candidate; an empty array returns the zero payload with the NO_CANDIDATES flag.

## Outputs

- as_of (string,null, optional)
- haircut_pct (number, optional)
- horizon_months (integer, optional)
- weeks_per_month (number, optional)
- candidates (array, optional)
- ranked (array, optional)
- keepers (array, optional)
- droppers (array, optional)
- net_keep_mo (number, optional)
- net_all_mo (number, optional)
- hours_reclaimed_wk (number, optional)
- horizon_net_keep (number, optional)
- horizon_net_all (number, optional)
- best_candidate (string,null, optional)
- fastest_breakeven_candidate (string,null, optional)
- fastest_breakeven_months (number,null, optional)
- verdict (string, optional)
- regulatory_basis (string, optional)
- note (string, optional)

## Sample

```json
{
  "as_of": "2026-10-13",
  "maintenance_haircut_pct": 20,
  "horizon_months": 24,
  "weeks_per_month": 4.33,
  "candidates": [
    {
      "name": "Invoice processing",
      "hours_saved_per_week": 3,
      "loaded_hourly_rate_usd": 45,
      "error_cost_avoided_usd_month": 150,
      "build_cost_usd": 2000,
      "subscription_usd_month": 60
    },
    {
      "name": "Report generation",
      "hours_saved_per_week": 2,
      "loaded_hourly_rate_usd": 55,
      "error_cost_avoided_usd_month": 75,
      "build_cost_usd": 500,
      "subscription_usd_month": 30
    },
    {
      "name": "Data-entry migration",
      "hours_saved_per_week": 5,
      "loaded_hourly_rate_usd": 28,
      "error_cost_avoided_usd_month": 200,
      "build_cost_usd": 3500,
      "subscription_usd_month": 120
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_automation_payback` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Compute Fund Expense Ratios

Computes a fund's gross and net expense ratios and Total Expense Ratio (TER) from SUPPLIED gross expense components (flat amounts or accruals, using the identical accrual conventions as recompute_fund_nav/FN-1) and average net assets, applying any declared fee waivers/caps strictly in a DECLARED order using fixed-point BigInt money math throughout (no float accumulation). Waiver ordering is the substance: the order in which fixed-dollar caps, percent-of-remaining reimbursements, and rate caps apply changes the net expense ratio, so the order is a required declared input, never a house convention, and every waiver's running-balance effect is returned for audit. HARD FENCE: every expense component, average-net-assets figure, and waiver term is supplied and asserted, never fetched (zero-egress); this recomputes the arithmetic over declared inputs and attests THAT, never an opinion on expense accuracy and never a compliance determination. Third entry of the Funds/NAV family (nav-verification-pack) alongside recompute_fund_nav (FN-1) and test_nav_error_materiality (FN-2). 40-Act/UCITS citations informative only.

- Page: https://ainumbers.co/chaingraph/art-375-compute-fund-expense-ratios.html
- Markdown twin: https://ainumbers.co/chaingraph/art-375-compute-fund-expense-ratios.md
- MCP tool: compute_fund_expense_ratios (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- average_net_assets (unknown, required)
- fund_id (unknown, optional)
- gross_expense_components (array, required)
- period_end (unknown, optional)
- period_start (unknown, optional)
- rounding (unknown, required)
- waivers (array, required)

## Outputs

- components (object, optional)
- fence (string, optional)
- fund_id (string, optional)
- gross_expense_ratio (string, optional)
- net_expense_ratio (string, optional)
- not_proven (array, optional)
- period_end (string, optional)
- period_start (string, optional)
- regulatory_framework (string, optional)
- rounding (object, optional)
- structural_error (string, optional)
- total_expense_ratio (string, optional)

## Sample

```json
{
  "fund_id": "FUND-EXP-01",
  "period_start": "2026-01-01",
  "period_end": "2026-12-31",
  "average_net_assets": 100000000,
  "gross_expense_components": [
    {
      "description": "management fee",
      "principal": 100000000,
      "annual_rate": 0.0075,
      "days": 365,
      "day_count_convention": "actual/365"
    },
    {
      "description": "admin fee",
      "amount": 150000
    },
    {
      "description": "12b-1 fee",
      "amount": 100000
    }
  ],
  "waivers": [],
  "rounding": {
    "decimal_places": 4,
    "mode": "half_up"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_fund_expense_ratios` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

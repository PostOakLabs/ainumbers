# Stock-Loan Rebate/Fee Recompute

Recomputes the periodic rebate or fee bill on an open securities loan that a borrower or beneficial owner receives from an agent lender or prime broker, using the caller's own declared daily collateral and rate data under the standard MSLA/SIFMA Actual/360 daily-accrual convention, then diffs the recomputed total against the statement's claimed amount. Supports both loan bases: rebate-basis loans (cash collateral, daily accrual of collateral value times the benchmark rate minus the rebate spread, with a negative spread-benchmark differential correctly flipping to a borrower-pays amount for a hard-to-borrow security) and fee-basis loans (a flat fee rate on the loaned security's market value, always borrower-pays). Separately checks every declared day's collateral value against the caller-declared SIFMA collateral-maintenance threshold (102% same-currency or 105% cross-currency) independent of whether the period's money total matches. Verdict MATCHES when the computed total agrees with the statement within a caller-declared tolerance and no collateral-mark breach occurred; DIVERGES when either check fails; INDETERMINATE when a required input (the tolerance, the margin percentage, the period, or at least one loan) is absent. The money side complementing the shipped FINRA SLATE reporting tools, which check regulatory transparency reporting rather than the bill itself. Balances are integer minor units and rates are integer basis points, so the arithmetic is exact. Performs arithmetic only over caller-declared daily collateral values, loaned-security market values, and rate/spread inputs; does not source or independently verify any value against a DTC feed, an agent lender's books, or a Reg SHO threshold-security list, and does not determine which collateral-maintenance percentage a given master agreement requires. Clause: SIFMA Master Securities Loan Agreement (MSLA) conventions plus FINRA's Securities Lending and Transparency Engine (SLATE, Rule 6500 Series) as the distinct reporting-side reference.

- Page: https://ainumbers.co/chaingraph/art-579-stock-loan-rebate-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-579-stock-loan-rebate-recompute.md
- MCP tool: recompute_stock_loan_rebate_fee (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- diff_tolerance_minor (unknown, required)
- loans (array, required)
- required_margin_pct (number, required): Percentage value
- statement_period (unknown, required)

## Outputs

- clause_note (string, optional)
- decision (object, optional)
- diff_tolerance_minor (integer, optional)
- findings (array, optional)
- loan_count (integer, optional)
- loans (array, optional)
- rejected_inputs (array, optional)
- required_margin_pct (integer, optional)
- scope_note (string, optional)
- statement_period (object, optional)
- verdict (string, optional)

## Sample

```json
{
  "diff_tolerance_minor": 50,
  "required_margin_pct": 102,
  "statement_period": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-03"
  },
  "loans": [
    {
      "loan_id": "loan-1",
      "basis": "rebate_basis",
      "statement_amount_minor": -3825,
      "daily_marks": [
        {
          "date": "2026-06-01",
          "loaned_market_value_minor": 10000000,
          "collateral_value_minor": 10200000,
          "benchmark_rate_bps": 500,
          "rebate_spread_bps": 50
        },
        {
          "date": "2026-06-02",
          "loaned_market_value_minor": 10000000,
          "collateral_value_minor": 10200000,
          "benchmark_rate_bps": 500,
          "rebate_spread_bps": 50
        },
        {
          "date": "2026-06-03",
          "loaned_market_value_minor": 10000000,
          "collateral_value_minor": 10200000,
          "benchmark_rate_bps": 500,
          "rebate_spread_bps": 50
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_stock_loan_rebate_fee` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

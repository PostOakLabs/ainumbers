# Muni Arbitrage Spending-Exception Checker

Tests whether a tax-exempt bond issue's declared expenditure schedule satisfies one of the three IRC section 148 arbitrage-rebate spending exceptions under Treas. Reg. section 1.148-7: the 6-month exception (100% spent by 6 months, or 95%/12mo with reasonable retainage), the 18-month exception (15%/6mo, 60%/12mo, 100%/18mo, or 95%/18mo plus 100%/30mo with reasonable retainage), or the 24-month construction exception (10%/6mo, 45%/12mo, 75%/18mo, 100%/24mo, or 95%/24mo plus 100%/36mo with reasonable retainage). Whether reasonable retainage is elected is always a caller-declared boolean, never assumed. A caller-declared de minimis amount, capped at the lesser of 3% of gross proceeds or $150,000, may be applied against the required spend at every milestone; an out-of-cap declaration is rejected rather than clamped. Each milestone date is computed calendar-wise from the issue date and receives its own verdict: MET when cumulative spending as of that date reached the required amount, FAILED when the date has passed without reaching it, or PENDING when the milestone date is still in the future relative to the caller-declared evaluation date. Overall exception status is FAILED if any milestone failed, PENDING if none failed but one or more are still pending, and MET only when every milestone has been met. Scope is deliberately narrow: this checks the spending-exception milestone tests only and does not compute the future-value arbitrage rebate itself, which is a separate tool. Clause: IRC section 148; Treas. Reg. section 1.148-7; IRS Pub 5271. Not tax advice.

- Page: https://ainumbers.co/chaingraph/art-569-muni-arbitrage-spending-exception-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-569-muni-arbitrage-spending-exception-checker.md
- MCP tool: check_muni_arbitrage_spending_exception (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- de_minimis_minor (unknown, required)
- elected_exception (unknown, required)
- expenditure_schedule (array, required)
- gross_proceeds_minor (unknown, required)
- issue_date (unknown, required)
- reasonable_retainage (unknown, required)

## Outputs

- as_of_date (string, optional)
- clause_note (string, optional)
- de_minimis_cap_minor (integer, optional)
- de_minimis_minor (string, optional)
- decision (object, optional)
- elected_exception (string, optional)
- gross_proceeds_minor (integer, optional)
- issue_date (string, optional)
- milestones (array, optional)
- overall_status (string, optional)
- reasonable_retainage (boolean, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- total_expenditures_minor (integer, optional)

## Sample

```json
{
  "issue_date": "2026-01-15",
  "as_of_date": "2026-12-01",
  "gross_proceeds_minor": 10000000000,
  "elected_exception": "6_MONTH",
  "reasonable_retainage": false,
  "expenditure_schedule": [
    {
      "date": "2026-02-01",
      "amount_minor": 4000000000,
      "description": "construction draw 1"
    },
    {
      "date": "2026-04-15",
      "amount_minor": 3500000000,
      "description": "construction draw 2"
    },
    {
      "date": "2026-07-10",
      "amount_minor": 2500000000,
      "description": "construction draw 3"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_muni_arbitrage_spending_exception` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

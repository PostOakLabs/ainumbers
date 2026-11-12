# Force-Placed Insurance Notice Checker

Checks a lender-placed (force-placed) insurance event against the notice sequence required before a servicer may charge the borrower: the 45-day advance first notice with its prescribed content set, the reminder notice at least 15 days before the charge and at least 30 days after the first notice, and the no-evidence-of-continuous-coverage precondition; evaluates the 15-day cancellation-and-refund clock with a pro-rata overlapping-coverage refund computed from values; and reports the charged premium against borrower-provided alternative-quote values as a values-only comparison table. Every element carries its paragraph citation. Missing quote values, invalid dates and amounts, and inverted coverage periods are refused, never computed. The node never labels a premium reasonable or unreasonable; the comparison is surfaced, the judgement is not.

- Page: https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.md
- MCP tool: check_force_placed_notice (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- first_notice_date (string, required)
- reminder_notice_date (string, required)
- charge_date (string, required)
- charged_premium_amount (number, required)
- charge_coverage_start (string, required)
- charge_coverage_end (string, required)
- alternative_quote_amount (number, optional)
- evidence_of_continuous_coverage_date (string, optional)
- borrower_coverage_start (string, optional)
- borrower_coverage_end (string, optional)
- cancellation_date (string, optional)
- refund_date (string, optional)
- refund_amount (number, optional)
- notice_mail_class (string, optional)
- first_notice_content_items (array, optional)

## Outputs

- verdict (string, optional)
- elements (array, optional)
- premium_benchmark (object,null, optional)
- refund_evaluation (object,null, optional)
- charge_summary (object, optional)
- evidence (object, optional)
- manual_review_required (boolean, optional)

## Sample

```json
{
  "first_notice_date": "2026-03-01",
  "reminder_notice_date": "2026-04-01",
  "charge_date": "2026-04-20",
  "charged_premium_amount": 1200,
  "charge_coverage_start": "2026-04-20",
  "charge_coverage_end": "2027-04-19",
  "alternative_quote_amount": 600
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_force_placed_notice` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

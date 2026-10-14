# Force-Placed Insurance Notice Checker

Checks a lender-placed (force-placed) insurance event against the 12 CFR 1024.37 notice sequence: the 45-day advance first notice with its prescribed content set, the reminder notice at least 15 days before the charge and at least 30 days after the first notice, and the no-evidence-of-continuous-coverage precondition; evaluates the 15-day cancellation-and-refund clock with a pro-rata overlapping-coverage refund computed from values; and reports the charged premium against a borrower-provided alternative quote as a values-only comparison table. The node never labels a premium reasonable or unreasonable; missing quote values, invalid dates and amounts are refused, never computed.

- Page: https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-734-force-placed-insurance-checker.md
- MCP tool: check_force_placed_notice (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- first_notice_date (string, required): Date the written first notice was delivered or mailed.
- reminder_notice_date (string, required): Date the reminder notice was delivered or mailed.
- charge_date (string, required): Date the force-placed premium charge was assessed.
- charged_premium_amount (number, required): Premium charge assessed for the coverage period.
- charge_coverage_start (string, required): Start of the period the charged premium covers.
- charge_coverage_end (string, required): End of the period the charged premium covers.
- alternative_quote_amount (number, optional): Borrower-provided alternative-quote premium for the values-only benchmark table; the benchmark refuses when it is missing.
- evidence_of_continuous_coverage_date (string, optional): Date evidence of continuous compliant coverage was received; triggers the 15-day cancel-and-refund evaluation.
- borrower_coverage_start (string, optional): Start of the borrower's own hazard coverage period; required to compute the pro-rata refund when evidence is present.
- borrower_coverage_end (string, optional): End of the borrower's own hazard coverage period.
- cancellation_date (string, optional): Date the force-placed coverage was cancelled.
- refund_date (string, optional): Date the refund was sent.
- refund_amount (number, optional): Refund amount reported.
- notice_mail_class (string, optional): Mail class enum: first_class, certified, registered, priority_express, other.
- first_notice_content_items (array, optional): Content-item keys present on the first notice (c2_i through c2_xi); when supplied, all eleven items are required.

## Outputs

- verdict (string, optional)
- elements (array, optional)
- premium_benchmark (object, optional)
- refund_evaluation (object, optional)
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

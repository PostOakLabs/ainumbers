# Servicing Compliance Clock

Computes servicer-compliance due dates and clock states from event dates and loan values: error-resolution and information-request clocks, loss-mitigation acknowledgment and evaluation, the 37-day pre-sale boundary, the 120-day pre-foreclosure bar, no-duplicate processing, force-placed-insurance notice, reminder, cancel and refund clocks, payment-crediting and payoff-statement deadlines, and ARM notice windows with their exception branches. Every obligation carries its paragraph citation and a named business-day calendar assumption. Invalid dates, removed rule branches and over-bound event sets are refused, never computed.

- Page: https://ainumbers.co/chaingraph/733-servicing-compliance-clock.html
- Markdown twin: https://ainumbers.co/chaingraph/733-servicing-compliance-clock.md
- MCP tool: servicing_compliance_clock (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- events (array, required): Event list, at most 32. Each event names a rule, a strict ISO trigger date, and rule-specific parameters.
  - rule (string, event parameter): Rule id from the node's catalog, e.g. error_acknowledgment, loss_mit_evaluation, payoff_statement, arm_payment_change_notice.
  - trigger_date (string, event parameter): Strict ISO YYYY-MM-DD event date that starts the clock. Required.
  - action_date (string, event parameter): Optional: the date the servicer acted; without it the clock reports state within.
  - error_category (integer, event parameter): error_investigation only: one of the eleven enumerated error categories, 1-11.
  - request_type (string, event parameter): info_request_response only: owner_identity (10 business days) or other (30).
  - foreclosure_sale_date (string, event parameter): Optional sale date powering the 45-day and 37-day gates and the sale-bounded error window.
  - extension_notice_given (boolean, event parameter): Written extension notice given before the deadline; adds 15 business days where the rule allows.
  - charge_date (string, event parameter): Force-placed insurance: the date the premium charge is assessed.
  - initial_notice_date (string, event parameter): Force-placed insurance reminder: the initial notice delivery date.
  - first_adjusted_payment_date (string, event parameter): ARM notice windows: first payment due at the adjusted level.
  - consummation_date (string, event parameter): arm_initial_adjustment_notice only: consummation date for the at-consummation case.
  - adjustment_frequency_days (integer, event parameter): ARM payment-change: uniformly scheduled adjustment interval in days; 60 or less selects the 25-day floor.
  - originated_before_2015_01_10 (boolean, event parameter): ARM payment-change pre-2015 short-index variant flag.
  - index_figure_lt_45_days (boolean, event parameter): ARM payment-change pre-2015 variant: index figure less than 45 days old.
  - first_adjustment_within_60_days_of_consummation (boolean, event parameter): ARM estimated-rate case flag.
  - disclosed_rate_was_estimate (boolean, event parameter): ARM estimated-rate case flag.
  - delinquency_date (string, event parameter): foreclosure_referral_120day alias of trigger_date semantics: date the obligation went delinquent.
  - prior_complete_application_date (string, event parameter): no_duplicate_processing: prior complete application date.
  - continuously_delinquent_since (boolean, event parameter): no_duplicate_processing: borrower delinquent at all times since the prior complete application.

## Outputs

- verdict (string, optional)
- obligations (array, optional)
- evidence (object, optional)
- manual_review_required (boolean, optional)

## Sample

```json
{
  "events": [
    {
      "rule": "error_acknowledgment",
      "trigger_date": "2026-10-14"
    },
    {
      "rule": "loss_mit_evaluation",
      "trigger_date": "2026-10-14",
      "foreclosure_sale_date": "2027-01-15"
    },
    {
      "rule": "payoff_statement",
      "trigger_date": "2026-10-14"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `servicing_compliance_clock` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

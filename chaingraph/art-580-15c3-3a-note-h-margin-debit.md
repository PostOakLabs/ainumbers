# 15c3-3a Note H Margin-Debit Computation

Recomputes whether a margin debit related to a broker-dealer's customer transactions in U.S. Treasury securities qualifies for inclusion in the Exchange Act Rule 15c3-3 customer or PAB reserve formula under Note H to Exhibit A (Rule 15c3-3a), and if so computes the debit amount. Note H permits that debit only once a registered clearing agency's rules satisfy several Commission-approved conditions and the margin itself comes from a permitted source. This kernel checks each condition as its own declared boolean, cited to the specific Note H subsection it comes from: Commission approval and published notice that Note H is satisfied for the named clearing agency; a separate, gross, per-customer margin calculation; cash margin invested only in short-term U.S. Treasury securities; margin held in a segregated Special Clearing Account at a Federal Reserve Bank or an FDIC-insured bank; and a system for returning excess margin no longer required. The source of the margin is separately checked against Note H's three permitted sources, including the narrow path where a broker-dealer's own Treasury securities may be used only if the customer lacked sufficient margin of its own and the broker-dealer recouped the advance by the next business day. The verdict is INCLUDABLE, NOT_INCLUDABLE, or INDETERMINATE, and INDETERMINATE covers both an unstated condition and missing margin-required or margin-on-deposit figures, neither of which is guessed toward either other verdict. Where INCLUDABLE, the debit is the smaller of the margin required and the margin actually on deposit, since Note H permits a debit no larger than either figure. Money is fixed point in integer minor units throughout with two-decimal display. Cites Exchange Act Rule 15c3-3a Note H by subsection and the SEC's Treasury-clearing compliance dates (cash trades by 2026-12-31, repo by 2027-06-30), each dated for re-verification against primary text. This kernel is a narrow sibling to the shipped art-396 15c3-3 reserve-formula tool: it recomputes only the Note H margin-debit sliver, never the full Items 1-14 reserve formula, and never edits art-396. Not legal or regulatory advice, and whether a clearing agency's rules and Commission notice actually satisfy Note H is for the broker-dealer's own compliance and financial-operations review.

- Page: https://ainumbers.co/chaingraph/art-580-15c3-3a-note-h-margin-debit.html
- Markdown twin: https://ainumbers.co/chaingraph/art-580-15c3-3a-note-h-margin-debit.md
- MCP tool: compute_note_h_margin_debit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- broker_dealer_ref (unknown, required)
- clearing_agency_conditions (unknown, required)
- clearing_agency_name (unknown, required)
- computation_date_label (unknown, required)
- currency (string, required)
- customer_insufficient_assets_declared (unknown, required)
- margin_called_and_received_next_business_day (unknown, required)
- margin_on_deposit_minor_units (unknown, required)
- margin_required_minor_units (unknown, required)
- margin_source (unknown, required)

## Outputs

- broker_dealer_ref (string, optional)
- citations (object, optional)
- clearing_agency_name (string, optional)
- commission_notice_dated (string, optional)
- computation_date_label (string, optional)
- conditions (array, optional)
- currency (string, optional)
- debit_display (string, optional)
- debit_minor_units (integer, optional)
- fence (string, optional)
- indeterminate_reason (string, optional)
- margin_on_deposit_display (string, optional)
- margin_on_deposit_minor_units (integer, optional)
- margin_required_display (string, optional)
- margin_required_minor_units (integer, optional)
- margin_source (string, optional)
- minor_unit_exponent (integer, optional)
- not_proven (array, optional)
- note (string, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- verdict (string, optional)

## Sample

```json
{
  "broker_dealer_ref": "SYNTH-BD-001",
  "computation_date_label": "2026-08-07 weekly reserve computation",
  "currency": "USD",
  "clearing_agency_name": "SYNTH-FICC-LIKE-CCA",
  "clearing_agency_conditions": {
    "commission_notice_published": true,
    "commission_notice_dated": "2024-11-25",
    "per_customer_gross_margin_calc": true,
    "cash_investment_short_term_treasuries_only": true,
    "special_clearing_account_designated": true,
    "excess_margin_return_system": true
  },
  "margin_source": "customer_cash",
  "margin_required_minor_units": 500000000,
  "margin_on_deposit_minor_units": 650000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_note_h_margin_debit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Borrower Escrow Auditor

Audits a servicer escrow accounting statement from borrower-supplied VALUES ONLY (zero PII by schema): recomputes the aggregate accounting trial running balance month by month from the stated opening balance, stated monthly escrow deposit values, and stated disbursement values, compares the servicer stated end-of-month balances line by line against the recomputation, flags each discrepant statement line with a per-line reason, checks the stated cushion against the one-sixth-of-estimated-total-annual-disbursements cap, and classifies the recomputed account as balanced, shortage, surplus, or deficiency with the corresponding remedy thresholds (50-dollar surplus refund floor conditioned on borrower currency, one-month-payment shortage spread trigger). Emits stable scalar evidence fields suitable for anchored-receipt shaping downstream. Declared domain exclusions: no tax-sale scenarios, no escrowed-MSA states, values only - identifier-like or free-text fields are refused, never echoed, and more than 12 monthly periods is refused.

- Page: https://ainumbers.co/chaingraph/732-borrower-escrow-auditor.html
- Markdown twin: https://ainumbers.co/chaingraph/732-borrower-escrow-auditor.md
- MCP tool: audit_borrower_escrow_statement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- starting_balance (number, required): Stated opening escrow balance at the start of the computation year, in dollars. Required.
- monthly_payments (array, required): Stated monthly escrow deposit values, one per month, at most 12 entries. Values only - never dates or identifiers.
- disbursements (array, required): Stated monthly escrow disbursement values, one per month, at most 12 entries. Values only.
- stated_balances (array, required): The servicer statement end-of-month balance values, one per month. Compared line by line against the recomputation.
- stated_cushion (number, optional): Optional: the servicer stated/target cushion amount. Checked against the one-sixth cap when supplied.
- borrower_current (boolean, optional): Optional: whether the borrower is current at the time of the analysis. Conditions the surplus refund obligation; when a refund-band surplus is present and this is not supplied the audit is held for manual review.

## Outputs

- verdict (string, optional)
- account_status (string,null, optional)
- periods_analyzed (integer, optional)
- recomputed_balances (array, optional)
- recomputed_low_point (number, optional)
- target_low_point (number, optional)
- total_annual_disbursements (number, optional)
- cushion_cap_amount (number, optional)
- stated_cushion (number,null, optional)
- cushion_within_cap (boolean,null, optional)
- shortage_amount (number, optional)
- surplus_amount (number, optional)
- shortage_spread_required (boolean, optional)
- surplus_refund_required (boolean, optional)
- surplus_refund_unverified (boolean, optional)
- discrepancies (object, optional)
- evidence (object, optional)
- manual_review_required (boolean, optional)

## Sample

```json
{
  "starting_balance": 0,
  "monthly_payments": [
    100,
    100,
    100,
    100,
    100,
    100,
    100,
    100,
    100,
    100,
    100,
    100
  ],
  "disbursements": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1200
  ],
  "stated_cushion": 0,
  "borrower_current": true,
  "stated_balances": [
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
    1000,
    1100,
    0
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_borrower_escrow_statement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

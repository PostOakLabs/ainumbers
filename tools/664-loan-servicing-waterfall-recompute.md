# Loan Servicing Waterfall Recompute

Independently recomputes how a single borrower's single loan payment applies across escrow, fee, interest and principal buckets under the note's own caller-declared bucket application order, then diffs the recomputed per-bucket breakdown against the core's actual applied amounts. The application order, pre-payment bucket balances and payment amount are all caller-declared contract terms - this node asserts no universal statutory application order and infers none. Verdict is MATCHES, DIVERGES (with per-bucket deltas), or INDETERMINATE whenever a required input - a declared bucket's balance, or the core's applied breakdown to diff against - is absent. Recompute and receipt only; this is not a claim that either side's figure is the legally correct one.

- Page: https://ainumbers.co/tools/664-loan-servicing-waterfall-recompute.html
- Markdown twin: https://ainumbers.co/tools/664-loan-servicing-waterfall-recompute.md
- MCP tool: compute_loan_servicing_waterfall_recompute (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- application_order (array, required)
- bucket_balances (object, required)
- payment_amount (integer, required)
- core_applied (object, optional)

## Outputs

- application_order (array,null, optional)
- payment_amount (integer,null, optional)
- computed_applied_by_bucket (object,null, optional)
- unapplied_remainder (integer,null, optional)
- core_applied (object,null, optional)
- per_bucket_deltas (array, optional)
- verdict (string, optional)
- missing_inputs (array, optional)

## Sample

```json
{
  "application_order": [
    "late_fee",
    "escrow_shortage",
    "escrow",
    "interest",
    "principal"
  ],
  "bucket_balances": {
    "late_fee": 500,
    "escrow_shortage": 1000,
    "escrow": 2000,
    "interest": 1500,
    "principal": 5000
  },
  "payment_amount": 10000,
  "core_applied": {
    "late_fee": 500,
    "escrow_shortage": 1000,
    "escrow": 2000,
    "interest": 1500,
    "principal": 5000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_loan_servicing_waterfall_recompute` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

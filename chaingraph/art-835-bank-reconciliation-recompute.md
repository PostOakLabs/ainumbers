# Bank Reconciliation Recompute

Recomputes a bank-to-book reconciliation and an optional proof of cash from declared values, in integer minor units. The caller declares the statement ending balance, the ledger ending balance, the as-of date, the outstanding deposits and outstanding payments (an id, a positive amount and an item date each), any other reconciling items (an id, a type of bank error, book error, bank fee, interest or other, the side it adjusts, a signed effect and an item date), a stale-item age threshold in days, and optionally a proof of cash with opening, receipts, disbursements and closing for the bank column and the book column. Returns the adjusted bank balance, the adjusted book balance, the unreconciled difference, the items older than the threshold with their age, the per-column proof-of-cash footing difference, whether each closing equals the declared balance, the movement difference, and a verdict of reconciled, unreconciled, indeterminate when a required fact is absent, or input_refused. Limits are 500 items per list and amounts within 1e12 minor units; a value that is present but null, of the wrong type, out of range, duplicated or after the as-of date is refused with a named code and never coerced. Ids and integers only: free-text labels, names and anything shaped like an account number are refused and never read. It recomputes a reconciliation from declared values. It does not read a bank statement and cannot tell whether a declared item is real. It is distinct from art-258, which parses camt.053 statements, art-566, which is an IOLTA three-way reconciliation, and art-499, art-516 and art-526; this node takes a plain bank balance, a book balance and a list of declared items. No adjacency is declared here.

- Page: https://ainumbers.co/chaingraph/art-835-bank-reconciliation-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-835-bank-reconciliation-recompute.md
- MCP tool: recompute_bank_reconciliation (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "statement_ending_balance_minor": 1000000,
  "ledger_ending_balance_minor": 1005000,
  "as_of_date": "2026-10-31",
  "stale_threshold_days": 90,
  "outstanding_deposits": [
    {
      "item_id": "dep1",
      "amount_minor": 20000,
      "item_date": "2026-10-30"
    }
  ],
  "outstanding_payments": [
    {
      "item_id": "chk1",
      "amount_minor": 10000,
      "item_date": "2026-10-20"
    },
    {
      "item_id": "chk2",
      "amount_minor": 5000,
      "item_date": "2026-10-25"
    }
  ],
  "other_items": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_bank_reconciliation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# IOLTA Three-Way Trust Reconciliation

Recomputes the monthly IOLTA/client-trust three-way close every small law firm already does by hand in a spreadsheet: the bank statement (adjusted for caller-declared deposits in transit and uncleared checks) against the trust ledger total against the sum of every per-client ledger balance, all as of the same statement period end. Separately walks each client's declared period activity to catch a client ledger that dips negative at any point during the period even when its ending balance looks fine: the classic commingling fact pattern where one client's disbursement is briefly funded by another client's money before a later deposit covers it. Ages every declared outstanding item from the period end so a check or deposit that has sat unresolved for months is visible rather than buried inside a balancing adjustment, and checks that every input balance is stated as of the same period-end date. Reconciliation tolerance is always a declared input, never defaulted; a negative client-ledger low point is never tolerance-gated. Verdict RECONCILED when the three-way equality holds, no client ledger went negative, no outstanding item is stale, and every date lines up; DISCREPANT when any of those breaks; INCOMPLETE when a required input (the tolerance, the period, a balance, or at least one client ledger) is absent. Balances are integer minor units, so the arithmetic is exact. Performs arithmetic only over caller-declared balances and caller-declared outstanding items; does not source, derive, or independently verify any balance, and does not itself determine which bank lines are outstanding. Clause: ABA Model Rule 1.15 (Safekeeping Property); state record-keeping rules govern the specifics and are cited in-page as dated illustrations only, never as a 50-state table.

- Page: https://ainumbers.co/chaingraph/art-566-iolta-three-way-reconciliation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-566-iolta-three-way-reconciliation.md
- MCP tool: check_iolta_three_way_reconciliation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bank (unknown, required)
- client_ledgers (array, required)
- outstanding_items (array, required)
- reconciliation_tolerance_minor (unknown, required)
- statement_period (unknown, required)
- trust_ledger (unknown, required)

## Outputs

- decision (object, optional)
- verdict (string, optional)
- statement_period (object, optional)
- reconciliation_tolerance_minor (integer, optional)
- three_way (object, optional)
- client_count (integer, optional)
- client_ledgers (array, optional)
- negative_balance_findings (array, optional)
- outstanding_items (array, optional)
- outstanding_summary (object, optional)
- period_boundary_consistent (boolean, optional)
- period_boundary_mismatches (array, optional)
- findings (array, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- clause_note (string, optional)

## Sample

```json
{
  "reconciliation_tolerance_minor": 100,
  "statement_period": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-30"
  },
  "bank": {
    "ending_balance_minor": 5000000,
    "statement_date": "2026-06-30"
  },
  "trust_ledger": {
    "ending_balance_minor": 5050000,
    "as_of": "2026-06-30"
  },
  "client_ledgers": [
    {
      "client_id": "client-A",
      "ending_balance_minor": 3000000,
      "as_of": "2026-06-30",
      "entries": [
        {
          "date": "2026-06-05",
          "amount_minor": 500000,
          "description": "deposit retainer"
        },
        {
          "date": "2026-06-20",
          "amount_minor": -200000,
          "description": "disbursement"
        }
      ]
    },
    {
      "client_id": "client-B",
      "ending_balance_minor": 2050000,
      "as_of": "2026-06-30",
      "entries": []
    }
  ],
  "outstanding_items": [
    {
      "type": "deposit_in_transit",
      "date": "2026-06-29",
      "amount_minor": 100000,
      "description": "client A retainer deposited 6/29"
    },
    {
      "type": "uncleared_check",
      "date": "2026-06-15",
      "amount_minor": 50000,
      "description": "disbursement check #1042"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_iolta_three_way_reconciliation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Bank/AR Confirmation Matcher

Joins caller-supplied bank and accounts-receivable confirmation responses against caller-supplied ledger balances on (counterparty_id, type), and classifies each pair EXACT_MATCH, TOLERANCE_MATCH, or MISMATCH, plus confirmations with no corresponding ledger balance and ledger balances with no corresponding confirmation. The match tolerance (tolerance_abs, tolerance_pct) is a caller-declared policy input; the explicit, echoed default is 0/0 (exact match required) when the caller declares neither - there is no silent, unrecorded tolerance. A duplicate (counterparty_id, type) key on either side is reported as a data-quality flag rather than silently overwritten - only the first occurrence on each side is joined. Third of three ARCB-K-1 substantive audit-recalculation kernels. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-464-confirmation-matcher.html
- Markdown twin: https://ainumbers.co/chaingraph/art-464-confirmation-matcher.md
- MCP tool: match_confirmations (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confirmations (unknown, required)
- ledger_balances (unknown, required)
- tolerance_abs (unknown, required)
- tolerance_pct (unknown, required): Percentage value

## Outputs

- duplicate_confirmation_keys (array, optional)
- duplicate_ledger_keys (array, optional)
- exact_count (integer, optional)
- matched (array, optional)
- matched_count (integer, optional)
- tolerance_count (integer, optional)
- tolerance_used (object, optional)
- total_confirmations (integer, optional)
- total_ledger_balances (integer, optional)
- unmatched (array, optional)
- unmatched_count (integer, optional)

## Sample

```json
{
  "tolerance_abs": 0,
  "tolerance_pct": 2,
  "confirmations": [
    {
      "confirmation_id": "C-1",
      "counterparty_id": "cp-A",
      "type": "bank",
      "confirmed_balance": 100000,
      "confirmation_date": "2026-01-31"
    },
    {
      "confirmation_id": "C-2",
      "counterparty_id": "cp-B",
      "type": "bank",
      "confirmed_balance": 50100,
      "confirmation_date": "2026-01-31"
    },
    {
      "confirmation_id": "C-3",
      "counterparty_id": "cp-C",
      "type": "ar",
      "confirmed_balance": 20000,
      "confirmation_date": "2026-01-31"
    },
    {
      "confirmation_id": "C-4",
      "counterparty_id": "cp-D",
      "type": "ar",
      "confirmed_balance": 7500,
      "confirmation_date": "2026-01-31"
    }
  ],
  "ledger_balances": [
    {
      "counterparty_id": "cp-A",
      "type": "bank",
      "ledger_balance": 100000,
      "as_of_date": "2026-01-31"
    },
    {
      "counterparty_id": "cp-B",
      "type": "bank",
      "ledger_balance": 50000,
      "as_of_date": "2026-01-31"
    },
    {
      "counterparty_id": "cp-C",
      "type": "ar",
      "ledger_balance": 15000,
      "as_of_date": "2026-01-31"
    },
    {
      "counterparty_id": "cp-E",
      "type": "ar",
      "ledger_balance": 9000,
      "as_of_date": "2026-01-31"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `match_confirmations` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

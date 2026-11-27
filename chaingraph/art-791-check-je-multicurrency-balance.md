# Multicurrency JE Balance Check

Checks that structured journal entries balance, on a basis the caller declares: either every currency sums to zero separately (per_currency) or the caller-declared functional-currency amounts sum to zero (functional), always in integer minor units with debit positive. There is no default basis and none is inferred: the same USD +10800 / EUR -10000 currency-conversion entry is imbalanced on the per-currency basis and balanced on the functional basis, and the basis pair fixture proves both. A per-currency integer tolerance may be declared; the tolerance actually used is echoed in the output and is never inferred (the Beancount-style inferred-tolerance pattern is deliberately not used). Currency exponents are declared by the caller and only membership is checked - the node does not fetch ISO 4217 and does not claim the declared exponents are authoritative. Amounts must be signed JSON integers checked with the safe-integer bound; non-integers are refused AMOUNT_NOT_INTEGER and integers beyond 2^53-1 are refused AMOUNT_UNSAFE_INTEGER, never coerced through floats. Named refusals cover the declared domain: BASIS_NOT_DECLARED, ENTRY_TOO_FEW_LINES, AMOUNT_NOT_INTEGER, AMOUNT_UNSAFE_INTEGER, UNKNOWN_CURRENCY, MISSING_FUNCTIONAL_AMOUNT, NEGATIVE_TOLERANCE, DUPLICATE_ENTRY_ID, DUPLICATE_LINE_ID, ENTRY_CAP_EXCEEDED. Out of scope in v1, stated plainly: the node does not recompute FX rates or check rounding lines - functional_minor is a caller-declared input, taken as given. This node does NOT claim any entry is correct, approved or compliant; it claims only that an entry's arithmetic closes on the declared basis, or reports by how much it does not, and it does not claim the declared functional amounts or rates are right. Sibling relationship: art-653 is the plain-text, single-currency, two-decimal journal-entry verifier (parser plus Merkle evidence); this node is the structured, multi-currency, caller-declared-basis check and does not extend or alter art-653.

- Page: https://ainumbers.co/chaingraph/art-791-check-je-multicurrency-balance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-791-check-je-multicurrency-balance.md
- MCP tool: check_je_multicurrency_balance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- policy_version (string, optional): Echoed through to the artifact.
- balance_basis (string, required): Required, no default; absent refuses BASIS_NOT_DECLARED.
- functional_currency (string, optional): Required when the basis is functional.
- tolerance_minor (object, optional): Optional declared integer tolerance >= 0 per currency; default 0, echoed in the output.
- currency_exponents (object, required): Declared currency code to minor-unit exponent map; membership checked only.
- entries (array, required): Journal entries (cap 500): entry_id, optional effective_date, lines of { line_id, account, currency, amount_minor, functional_minor? }.

## Outputs

- execution_state (string, optional)
- reason (string, optional)
- basis (string, optional)
- functional_currency (string,null, optional)
- tolerance_used (object, optional)
- entry_cap (integer, optional)
- entries (array, optional)
- totals (object, optional)

## Sample

```json
{
  "policy_version": "1.0.0",
  "balance_basis": "per_currency",
  "currency_exponents": {
    "USD": 2,
    "EUR": 2,
    "JPY": 0,
    "KWD": 3
  },
  "entries": [
    {
      "entry_id": "E1",
      "lines": [
        {
          "line_id": "L1",
          "account": "cash",
          "currency": "USD",
          "amount_minor": 10000
        },
        {
          "line_id": "L2",
          "account": "revenue",
          "currency": "USD",
          "amount_minor": -10000
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_je_multicurrency_balance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

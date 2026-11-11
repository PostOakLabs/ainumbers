# Omnibus Token Position Reconciliation

Reconciles a tokenized-securities omnibus token position against caller-declared state: it sums the balances of every declared wallet, computes the omnibus-versus-wallets and omnibus-versus-book-entry deltas, chains a SHA-256 log head over the declared mint, burn, forced-transfer and transfer events in sequence order, counts forced transfers, and returns a RECONCILED / MISMATCH / UNDECIDABLE verdict within a declared integer tolerance. Venue-neutral arithmetic with two profiles: dtc_dts applies the registered-wallet rule from the pinned no-action letter (tokens are only transferable to Registered Wallets, so an unregistered wallet holding a balance is flagged and forces MISMATCH, never dropped from the sum), generic_omnibus runs the same sums without that rule. All inputs are caller-asserted aggregates under opaque labels: integer base units as decimal strings only, floats refused, negative balances refused, identifier-shaped labels (email, LEI, IBAN, long digit runs) refused and never echoed. Honest scope: this proves the arithmetic over the balances you declared. It does not read any ledger, queries nothing, and does not prove the balances are real.

- Page: https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.html
- Markdown twin: https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.md
- MCP tool: reconcile_omnibus_position (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, optional): dtc_dts applies the registered-wallet rule from the pinned no-action letter; generic_omnibus omits it. Absent defaults to generic_omnibus with a flag.
- as_of (string, optional): Caller-declared snapshot date label, YYYY-MM-DD. No clock is read.
- omnibus_balance (string, optional): The omnibus token position in integer base units as a decimal string. Numbers, fractional, signed, or malformed values are refused, never coerced.
- book_entry_position (string, optional): The custodian's book-entry position, integer base units as a decimal string, same refusal domain as omnibus_balance.
- tolerance_units (number, optional): Inclusive tolerance band in integer base units applied to both legs; 0 when absent. Negative or fractional values are refused.
- wallets (array, optional): Per-wallet declared balances under opaque labels: wallet_label (opaque, unique, PII-shaped refused), balance (decimal string), registered (boolean).
- events (array, optional): Declared log entries chained in seq order: seq (unique integer), kind (mint, burn, forced_transfer, transfer), amount (decimal string), wallet_label.

## Outputs

- verdict (string, optional)
- profile (string,null, optional)
- as_of (string,null, optional)
- tolerance_units (integer,null, optional)
- omnibus_balance (string,null, optional)
- book_entry_position (string,null, optional)
- wallet_count (integer,null, optional)
- registered_wallet_count (integer,null, optional)
- unregistered_wallet_count (integer,null, optional)
- unregistered_wallets_holding_balance (integer,null, optional)
- sum_wallets (string,null, optional)
- omnibus_vs_wallets_delta (string,null, optional)
- omnibus_vs_book_delta (string,null, optional)
- legs (object,null, optional)
- event_log_head (string,null, optional)
- events_counted (integer,null, optional)
- event_counts (object,null, optional)
- forced_transfer_count (integer,null, optional)
- refused_because (string, optional)
- refused_field (string, optional)
- warnings (array, optional)
- evidence (object, optional)
- manual_review_required (boolean, optional)

## Sample

```json
{
  "profile": "dtc_dts",
  "as_of": "2026-11-07",
  "omnibus_balance": "1000000",
  "book_entry_position": "1000000",
  "tolerance_units": 0,
  "wallets": [
    {
      "wallet_label": "w1",
      "balance": "400000",
      "registered": true
    },
    {
      "wallet_label": "w2",
      "balance": "600000",
      "registered": true
    }
  ],
  "events": [
    {
      "seq": 0,
      "kind": "mint",
      "amount": "1000000",
      "wallet_label": "w1"
    },
    {
      "seq": 1,
      "kind": "transfer",
      "amount": "600000",
      "wallet_label": "w2"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_omnibus_position` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

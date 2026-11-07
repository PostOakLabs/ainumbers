# Omnibus Token Position Reconciliation

Reconciles a declared tokenized-securities omnibus token position against the sum of declared registered-wallet balances and a declared custodian book-entry position: recomputes the wallet sum exactly in integer base units, computes the omnibus-versus-wallets and omnibus-versus-book deltas with their signs, compares each absolute delta against a declared inclusive tolerance, chains a SHA-256 head over the declared mint, burn, forced-transfer and transfer events in sequence order, counts forced transfers, and returns a RECONCILED, MISMATCH, or UNDECIDABLE verdict. Two profiles: dtc_dts applies the registered-wallet rule from the pinned no-action letter (tokens are only transferable to Registered Wallets, so an unregistered wallet holding a balance is flagged and forces MISMATCH, never dropped from the sum); generic_omnibus runs the same sums without that rule. It states plainly that it proves only the arithmetic over the balances you declared: it reads no ledger, queries nothing, and does not prove the balances are real. Refusal branches cover JSON numbers and fractional, negative, or malformed decimal strings (never echoed), identifier-shaped wallet labels (email, LEI, IBAN, long digit runs), duplicate labels and sequence numbers, event kinds outside the four declared kinds, and non-boolean registration flags. Declared exclusions: declared aggregates only, no ledger or chain access, no event-log completeness proof, no link between the declared state and reality, no market or price figures, not investment advice.

- Page: https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.html
- Markdown twin: https://ainumbers.co/chaingraph/art-828-reconcile-omnibus-token-position.md
- MCP tool: reconcile_omnibus_position (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, optional): Reconciliation profile, dtc_dts or generic_omnibus. Absent defaults to generic_omnibus with a PROFILE_ABSENT flag; any other value is refused.
- as_of (string, optional): Caller-declared snapshot date label, YYYY-MM-DD. No clock is read; anything outside that shape is refused.
- omnibus_balance (string, optional): The omnibus token position in integer base units as a decimal string. A JSON number, a fractional or signed string, or a malformed decimal is refused, never coerced.
- book_entry_position (string, optional): The custodian's book-entry position for the same holding, integer base units as a decimal string, same refusal domain as omnibus_balance.
- tolerance_units (number, optional): Inclusive tolerance band in integer base units applied to both legs' absolute deltas; 0 when absent. Negative or fractional values are refused.
- wallets (array, optional): Per-wallet declared balances under opaque labels. Each entry carries wallet_label (opaque, unique; identifier-shaped labels refused as PII, never echoed), balance (decimal string; a missing balance member is refused, never assumed zero), and registered (boolean).
- events (array, optional): Declared event log entries chained in seq order. Each entry carries seq (unique non-negative integer), kind (mint, burn, forced_transfer, or transfer), amount (decimal string), and wallet_label (same opaque-label domain).

## Outputs

- verdict (string, optional)
- profile (string, optional)
- as_of (string, optional)
- tolerance_units (integer, optional)
- omnibus_balance (string, optional)
- book_entry_position (string, optional)
- wallet_count (integer, optional)
- registered_wallet_count (integer, optional)
- unregistered_wallet_count (integer, optional)
- unregistered_wallets_holding_balance (integer, optional)
- sum_wallets (string, optional)
- omnibus_vs_wallets_delta (string, optional)
- omnibus_vs_book_delta (string, optional)
- legs (object, optional)
- event_log_head (string, optional)
- events_counted (integer, optional)
- event_counts (object, optional)
- forced_transfer_count (integer, optional)
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
    { "wallet_label": "w1", "balance": "400000", "registered": true },
    { "wallet_label": "w2", "balance": "600000", "registered": true }
  ],
  "events": [
    { "seq": 0, "kind": "mint", "amount": "1000000", "wallet_label": "w1" },
    { "seq": 1, "kind": "transfer", "amount": "600000", "wallet_label": "w2" }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_omnibus_token_position` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

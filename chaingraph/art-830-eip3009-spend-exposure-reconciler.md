# EIP-3009 Spend Exposure Reconciler

Reconciles a caller-pasted EIP-3009 (ERC-3009, Draft) authorization ledger against caller-pasted AuthorizationUsed and AuthorizationCanceled event rows on a caller-supplied clock, totaling outstanding spend exposure and listing every disagreement with the ledger's own status. Each entry is classified into exactly one class: settled (a used event row matches the identity), canceled (a canceled event row matches), not_yet_valid (no event row matches and the caller clock is at or before the entry's validAfter; excluded from total_outstanding and disclosed beside it), expired_unspent (no event row matches and the strict upper validity bound is at or before the caller clock), outstanding (window open, meaning validAfter is before the clock and the clock is before validBefore, value counted in total_outstanding), or not_evaluated (the identity carries both a used and a canceled row, the clock is absent for a signed entry, or the entry repeats the authorizer, token, chain and nonce of an earlier ledger entry and is flagged DUPLICATE_NONCE_LEDGER, so only the first in canonical order is counted). Event rows match ledger identities by authorizer and nonce, with optional per-row token and chain_id narrowing; an unscoped row spanning more than one token or chain identity is flagged AMBIGUOUS_EVENT_SCOPE and applied to none, a repeated identical row is flagged and applied once, and a row matching no ledger entry is flagged EVENT_WITHOUT_LEDGER_ENTRY. Every applied event row that contradicts the ledger's status claim is itemized under one of four LEDGER_SAYS discrepancy codes. A used and a canceled row on the same identity is EVENT_CONFLICT: the entry is not_evaluated, its value is excluded from the total and disclosed separately in unresolved_conflict_value. An absent event list or absent clock marks that aspect not_evaluated rather than treating it as empty, and total_outstanding is null whenever any signed entry lacks a clock verdict. Arithmetic is integer-only decimal-string uint256 with fixed scan bounds. Zero network calls, no chain reads, no signature recovery: all rows are caller-attested pasted evidence, the cited standard is a Draft, and the output is a reconciliation over pasted records, not a conformance verdict about any token implementation, not an authorization to move funds and not proof that funds moved.

- Page: https://ainumbers.co/chaingraph/art-830-eip3009-spend-exposure-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-830-eip3009-spend-exposure-reconciler.md
- MCP tool: reconcile_eip3009_spend_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "ledger": [
    {
      "from": "0x1111111111111111111111111111111111111111",
      "token": "0x31c8eacbff8e47cfbefd98d63ab04cbaff51c9cc",
      "chain_id": "84532",
      "nonce": "0xabababababababababababababababababababababababababababababababab",
      "to": "0x2222222222222222222222222222222222222222",
      "value": "500",
      "validAfter": "1700000000",
      "validBefore": "1700007200",
      "signed_at": 1700000100,
      "status": "signed"
    }
  ],
  "now_unix": 1700001000
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_eip3009_spend_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# ZIP-317 Transfer Fee

Recomputes the conventional transfer fee for a Zcash transaction from a DECLARED shape the caller pastes - counts and byte totals only, never keys and never raw transactions: the transparent contribution is the greater of ceil(tx_in_total_size/150) and ceil(tx_out_total_size/34), Sprout contributes twice the JoinSplit count, Sapling contributes the greater of spends and outputs, Orchard contributes its action count, and the fee is 5000 zatoshi per logical action floored by the two-action grace window, exactly as the pinned fee-rule text defines. Integer arithmetic only, zero network; no key material is read or required (no viewing key, no spending key); a string in a declared numeric field is refused and never echoed. Honest label: this computes the fee the published rule yields for the declared shape; it is not a statement about what any wallet or node will accept at a given time, and it is not coin marketing. Declared exclusions: draft-revision contributions (added action pools, memo bundles) are refused rather than guessed; negative, fractional, or out-of-range counts and sizes are refused.

- Page: https://ainumbers.co/chaingraph/824-zip317-transfer-fee.html
- Markdown twin: https://ainumbers.co/chaingraph/824-zip317-transfer-fee.md
- MCP tool: recompute_zip317_transfer_fee (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "n_actions_orchard": 2
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_zip317_transfer_fee` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

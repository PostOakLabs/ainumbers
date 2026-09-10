# Consolidation with CTA and Minority Interest

Deterministic foreign-subsidiary consolidation arithmetic over caller-declared synthetic inputs, per the translation method. From a declared subsidiary equity in functional currency, declared current and historical translation rates, and a declared parent ownership percentage, it computes: equity translated at the current rate and at the historical rate (2 decimal places, half-up), the cumulative translation adjustment as the difference between the two translated figures, and the split of translated equity into parent share and minority (non-controlling) interest at the declared ownership, with the parent and minority shares always summing back to translated equity. Overall verdict CONSOLIDATION_COMPUTED on any well-formed input, CONSOLIDATION_REFUSED on the fail-closed path. No subsidiary register, no rate table, no FX feed, no ledger store, no network, no clock: every equity figure, rate, and percentage is a caller-declared input, never fetched or inferred. This is consolidation arithmetic, NOT accounting advice, NOT a determination that any presentation satisfies any reporting framework, NOT a valuation of any subsidiary, and NOT a filing: nothing is posted anywhere. An absent, malformed, or out-of-domain input (non-positive equity or rate, ownership outside 0 to 100 exclusive) resolves to a fail-closed payload naming each rejected input, never a silently repaired consolidation. Rounding is 2 decimal places, half-up, applied in-kernel and stated in the trace; the canonical trace shape is 110000-100000=10000 CTA; split 80/20 of 110000.

- Page: https://ainumbers.co/tools/683-consolidation-cta-minority-interest.html
- Markdown twin: https://ainumbers.co/tools/683-consolidation-cta-minority-interest.md
- MCP tool: compute_consolidation_cta (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "sub_equity_fc": 100000,
  "rate_current": 1.1,
  "rate_historical": 1,
  "parent_ownership_pct": 80
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_consolidation_cta` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

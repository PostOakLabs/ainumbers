# Short-Sale Locate and SSR Checker

Deterministic locate-documentation and SSR-flag arithmetic over caller-declared synthetic inputs. Classifies a declared short-sale order against declared locate documentation (declared source, list date, on-list flag) and carries the caller-declared short-sale price restriction (SSR) flag verbatim: locate_satisfied follows the declared on-list flag, ssr_restriction is a pass-through of the declared flag (the price test itself belongs to the caller's feeds), and overall resolves to LOCATE_MISSING, SSR_RESTRICTED, or LOCATE_DOCUMENTED. Pairs with T372 (buy-in scope classifier) when no locate is documented. No borrow lists, no SSR tapes, no cutoff feeds, no registers, no network, no clock: every order, locate fact, and flag is a caller-declared input, never fetched or inferred. This is a checker of declared-input arithmetic, NOT compliance advice, NOT a recommendation to borrow, locate, cover, or trade, and NOT connected to any live feed or register - a declared on-list flag is documentation the caller asserts, never a fact this kernel verified; the not_proven discipline applies. An absent or invalid order, locate, or flag resolves to a fail-closed payload naming each rejected input, never a silently repaired classification. Settled classification arithmetic; it cites no external standard.

- Page: https://ainumbers.co/tools/671-short-sale-locate-ssr-checker.html
- Markdown twin: https://ainumbers.co/tools/671-short-sale-locate-ssr-checker.md
- MCP tool: compute_short_sale_locate_ssr_checker (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "order": {
    "side": "sell_short",
    "qty": 5000,
    "symbol": "SYN-B"
  },
  "locate": {
    "source": "easy_to_borrow_list",
    "list_date": "2026-09-03",
    "on_list": true
  },
  "ssr_active": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_short_sale_locate_ssr_checker` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

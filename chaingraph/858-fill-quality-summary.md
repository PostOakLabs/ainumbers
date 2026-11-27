# Fill Quality Summary

Summarises the fill quality of one order from the fills the caller declares, in exact integer arithmetic. Given the order side and target quantity, a currency from a closed ISO 4217 table, an optional price scale of 0 to 8 decimals (default: the currency's minor unit), up to 5,000 fills, a declared market volume with its window label, and the counts of orders placed and cancelled, it returns the filled and unfilled quantity, the fill rate, the volume-weighted average price with its exact signed residual (sum of price times quantity minus VWAP times filled quantity, so the rounding is visible), participation against the declared market volume, the share of the fill that came from auctions, the cancel ratio, and the order-to-trade ratio (orders placed divided by fills count, which mixes an order count with an execution count). Prices and quantities are integer strings; rates and ratios are strings with two decimals, rounded half away from zero. Every refused field is named and no figure is computed on a refusal; participation is never shown above 100%. A calculation check on caller-declared fills and market volume, not investment advice and not a best-execution determination. No market data is fetched; the market volume and its window are the caller's declaration. It computes no arrival shortfall and no opportunity cost.

- Page: https://ainumbers.co/chaingraph/858-fill-quality-summary.html
- Markdown twin: https://ainumbers.co/chaingraph/858-fill-quality-summary.md
- MCP tool: summarize_fill_quality (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "order_side": "buy",
  "order_target_qty": "1000",
  "currency": "USD",
  "market_volume_shares": "20000",
  "market_volume_window": "session-2026-11-26",
  "orders_placed": "4",
  "cancels": "1",
  "fills": [
    {
      "fill_id": "f1",
      "side": "buy",
      "currency": "USD",
      "price": "9990",
      "quantity_shares": "400",
      "venue_type": "auction"
    },
    {
      "fill_id": "f2",
      "side": "buy",
      "currency": "USD",
      "price": "10010",
      "quantity_shares": "600",
      "venue_type": "continuous"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `summarize_fill_quality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

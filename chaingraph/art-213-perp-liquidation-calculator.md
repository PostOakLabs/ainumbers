# Perp Margin and Liquidation Calculator

Computes perp liquidation price, margin health, buffer, and distance to liquidation for isolated and cross-margin modes. Covers Hyperliquid, dYdX v4, Binance, GMX, and generic venues. Includes portfolio-margin spot-offset and cross-margin efficiency calculation. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-213-perp-liquidation-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-213-perp-liquidation-calculator.md
- MCP tool: compute_perp_margin (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- correlation (number, optional)
- entry_price (number, optional)
- leverage (number, optional)
- mark_price (number, required)
- mmr_pct (number, required): Percentage value
- mode (unknown, required)
- position_size (number, optional)
- side (unknown, required)
- spot_offset_usd (number, optional): Amount in US dollars
- venue (unknown, required)

## Outputs

- buffer (number, required)
- buffer_pct (number, required)
- cross_margin_efficiency (null,object, required)
- disclaimer (string, required)
- distance_to_liq_pct (number, required)
- entry_price (number, required)
- health (string, required)
- imr_pct (number, required)
- initial_margin (number, required)
- leverage (number, required)
- liq_price (number, required)
- maintenance_threshold (number, required)
- margin_balance (number, required)
- mark_price (number, required)
- mark_price_note (string, required)
- mmr_pct (number, required)
- mode (string, required)
- notional (number, required)
- portfolio_margin_note (null,string, required)
- position_size (number, required)
- side (string, required)
- unrealized_pnl (number, required)
- venue (string, required)

## Sample

```json
{
  "venue": "hyperliquid",
  "side": "long",
  "mode": "isolated",
  "leverage": 5,
  "entry_price": 50000,
  "mark_price": 48000,
  "position_size": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_perp_margin` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

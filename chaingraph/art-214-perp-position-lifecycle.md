# Perp Position Lifecycle

Models a full perp position from open to close: liquidation price, realized PnL, cumulative funding over the holding period, taker and maker fees, and margin return. Hyperliquid hourly funding cadence default. Static-string timestamps. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-214-perp-position-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/art-214-perp-position-lifecycle.md
- MCP tool: model_perp_position (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- close_fee_type (unknown, required)
- close_ts (unknown, required)
- entry_price (number, optional)
- exit_price (number, optional)
- funding_rate_per_interval (number, optional)
- leverage (number, optional)
- maker_fee_pct (number, optional): Percentage value
- mmr_pct (number, required): Percentage value
- n_intervals (number, optional)
- open_fee_type (unknown, required)
- open_ts (unknown, required)
- position_size (number, optional)
- side (unknown, required)
- taker_fee_pct (number, optional): Percentage value
- venue (unknown, required)

## Outputs

- close_fee (number, required)
- close_fee_type (string, required)
- close_ts (string, required)
- disclaimer (string, required)
- entry_price (number, required)
- exit_price (number, required)
- funding_rate_per_interval (number, required)
- initial_margin (number, required)
- leverage (number, required)
- liq_price (number, required)
- maintenance_threshold (number, required)
- margin_return_pct (number, required)
- margin_returned (number, required)
- mmr_pct (number, required)
- n_intervals (number, required)
- notional (number, required)
- open_fee (number, required)
- open_fee_type (string, required)
- open_ts (string, required)
- position_size (number, required)
- price_delta (number, required)
- realized_pnl_gross (number, required)
- realized_pnl_net (number, required)
- side (string, required)
- total_fees (number, required)
- total_funding_impact (number, required)
- total_net_pnl (number, required)
- venue (string, required)

## Sample

```json
{
  "venue": "hyperliquid",
  "side": "long",
  "entry_price": 50000,
  "exit_price": 55000,
  "position_size": 1,
  "leverage": 5,
  "n_intervals": 24,
  "funding_rate_per_interval": 0.0001
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_perp_position` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

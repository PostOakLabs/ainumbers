# Prediction Market Arbitrage

Calculates cross-venue prediction market arbitrage: gross spread, fee-adjusted net edge, required capital, and minimum spread to survive fees. Covers Polymarket, Kalshi, SX Bet, and Robinhood. A 6% gross spread nets roughly 1-2% after Kalshi fees. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.md
- MCP tool: find_prediction_arbitrage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- no_price_b (number, optional)
- payout (number, optional)
- stake_total (number, optional)
- venue_a (unknown, required)
- venue_b (unknown, required)
- yes_price_a (number, optional)

## Outputs

- arb_exists (boolean, required)
- capital_deployed (number, required)
- consensus_gap (number, required)
- disclaimer (string, required)
- fee_a (number, required)
- fee_b (number, required)
- gross_profit (number, required)
- gross_spread (number, required)
- gross_spread_pct (number, required)
- implied_prob_yes_a (number, required)
- implied_prob_yes_b (number, required)
- k_contracts (number, required)
- min_spread_to_break_even (number, required)
- net_edge_pct (number, required)
- net_profit (number, required)
- no_price_b (number, required)
- payout (number, required)
- stake_total (number, required)
- total_fees (number, required)
- venue_a (string, required)
- venue_b (string, required)
- yes_price_a (number, required)

## Sample

```json
{
  "venue_a": "polymarket",
  "venue_b": "kalshi",
  "yes_price_a": 0.45,
  "no_price_b": 0.5,
  "payout": 1,
  "stake_total": 1000
}
```

## Verify

Run the sample policy_parameters through MCP tool `find_prediction_arbitrage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

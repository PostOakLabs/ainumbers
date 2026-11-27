# Prediction Market Arbitrage

Calculates cross-venue prediction market arbitrage: gross spread, fee-adjusted net edge, required capital, and minimum spread to survive fees. Covers Polymarket, Kalshi, SX Bet, and Robinhood. A 6% gross spread nets roughly 1-2% after Kalshi fees. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-212-prediction-market-arbitrage.md
- MCP tool: find_prediction_arbitrage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (any, required): type not evidenced by kernel source
- fee_regime (any, required): type not evidenced by kernel source
- market_category (any, required): type not evidenced by kernel source
- no_price_b (number, optional)
- payout (number, optional)
- stake_total (number, optional)
- venue_a (any, required): type not evidenced by kernel source
- venue_b (any, required): type not evidenced by kernel source
- yes_price_a (number, optional)

## Outputs

- arb_exists (boolean, required)
- capital_deployed (number, required)
- consensus_gap (number, required)
- disclaimer (string, required)
- fee_a (number, required)
- fee_as_of (null,string, required)
- fee_b (number, required)
- fee_market_category (string,null, required)
- fee_regime_a (string, required)
- fee_regime_b (string, required)
- fee_theta_a (string, required)
- fee_theta_b (string,null, required)
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

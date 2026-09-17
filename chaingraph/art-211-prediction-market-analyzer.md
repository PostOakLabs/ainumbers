# Prediction Market Analyzer

Computes prediction market PnL, implied probability, break-even, no-vig fair value, expected value, Kelly stake, and odds conversion for binary and scalar contracts. Covers Polymarket, Kalshi, CME Event, and Robinhood. Includes Brier and log-score forecast accuracy metrics. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-211-prediction-market-analyzer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-211-prediction-market-analyzer.md
- MCP tool: analyze_prediction_market (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bankroll (number, optional)
- contract_max (number, optional)
- contract_min (number, optional)
- entry_price (number, optional)
- forecast_prob (number, required)
- mode (unknown, required)
- n_contracts (number, optional)
- no_ask (number, required)
- outcome (boolean, required)
- payout (number, optional)
- settlement_value (number, optional)
- side (unknown, required)
- strike (number, optional)
- unit_value (number, optional)
- user_probability (number, required)
- venue (unknown, required)
- won (boolean, required)

## Outputs

- break_even_probability (number, optional)
- brier_score (null,number, optional)
- disclaimer (string, required)
- entry_price (number, optional)
- expected_value (null,number, optional)
- fee_paid (number, optional)
- half_kelly_stake (null,number, optional)
- implied_probability (number, optional)
- kelly_fraction (null,number, optional)
- log_score (null,number, optional)
- mode (string, required)
- n_contracts (number, required)
- no_vig_fair_value (number, optional)
- odds_american (number, optional)
- odds_decimal (number, optional)
- odds_fractional (string, optional)
- payout (number, optional)
- pnl (number, required)
- settlement_clamped (number, optional)
- settlement_delta (number, optional)
- settlement_in_range (boolean, optional)
- settlement_value (number, optional)
- side (string, required)
- strike (number, optional)
- unit_value (number, optional)
- venue (string, required)
- won (number, optional)

## Sample

```json
{
  "mode": "binary",
  "venue": "polymarket",
  "side": "yes",
  "entry_price": 0.6,
  "n_contracts": 100,
  "payout": 1,
  "won": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `analyze_prediction_market` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

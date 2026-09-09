# Halt + Staleness Collateral Haircut

Layers a feed-staleness, sequencer-downtime, and underlying-halt haircut on top of a base repo haircut for Robinhood Chain stock tokens posted as collateral. 46 percent of first-week stock-token transfers settled outside NYSE hours, and the docs name Chainlink staleness checks plus Arbitrum sequencer-uptime validation as required practice. Downstream of check_tokenized_collateral_eligibility and calculate_repo_haircut in the collateral-haircut chain. Returns a liquidation-risk classification: normal, elevated, or blocked. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.html
- Markdown twin: https://ainumbers.co/chaingraph/art-320-rhc-collateral-haircut.md
- MCP tool: compute_stock_token_collateral_haircut (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- base_haircut (unknown, optional)
- current_time (unknown, optional)
- feed_round (unknown, optional)
- position_value (unknown, optional)
- sequencer_uptime (unknown, optional)
- underlying_market_state (unknown, optional)

## Outputs

- adjusted_collateral_value (integer, optional)
- base_haircut (number, optional)
- extra_haircut (integer, optional)
- feed_stale (boolean, optional)
- final_haircut (number, optional)
- liquidation_risk (string, optional)
- sequencer_down_grace_expired (boolean, optional)
- sequencer_down_within_grace (boolean, optional)
- underlying_halted (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "position_value": 100000,
  "base_haircut": 0.15,
  "feed_round": {
    "timestamp": 1000,
    "heartbeat_seconds": 3600
  },
  "current_time": 2000,
  "sequencer_uptime": {
    "is_up": true
  },
  "underlying_market_state": {
    "is_halted": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_stock_token_collateral_haircut` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

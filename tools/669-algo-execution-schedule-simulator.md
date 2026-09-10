# Algo Execution Schedule Simulator

Deterministic execution-schedule arithmetic over caller-declared synthetic inputs. Slices a declared order three ways - VWAP (across a declared volume_profile_pct that must sum to exactly 100, fail closed otherwise), TWAP (across a declared bucket count with a declared remainder rule for indivisible remainders), and POV (a declared participation rate of declared per-bucket volumes, capped at the remaining order) - and decomposes implementation shortfall against declared arrival and average-fill prices: shortfall_bps = (avg_fill - arrival) / arrival * 10000 and shortfall_cost = (avg_fill - arrival) * order_shares, sign-corrected by side so positive always reads cost. No market data, no feeds, no network, no clock: every profile, volume, and price is a caller-declared input, never fetched or inferred. This is a simulator of schedule arithmetic, NOT personalized investment advice, NOT a recommendation to trade or to choose any method or schedule, and NOT an order router - it never sends, stages, or routes any order to any venue. An absent or invalid side, order, method, profile, bucket structure, rate, or price resolves to a fail-closed payload naming each rejected input, never a silently repaired schedule. Settled arithmetic (slicing and shortfall decomposition); it cites no external standard.

- Page: https://ainumbers.co/tools/669-algo-execution-schedule-simulator.html
- Markdown twin: https://ainumbers.co/tools/669-algo-execution-schedule-simulator.md
- MCP tool: compute_algo_execution_schedule_simulator (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "side": "buy",
  "order_shares": 100000,
  "method": "vwap",
  "volume_profile_pct": [
    10,
    25,
    30,
    20,
    15
  ],
  "arrival_price": 50,
  "avg_fill_price": 50.06
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_algo_execution_schedule_simulator` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

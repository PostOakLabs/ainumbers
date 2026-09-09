# Options Greeks Calculator

Black-Scholes options pricer with full Greeks (delta, gamma, theta, vega, rho). Equity, FX and rate presets; payoff profile and sensitivity charts. Zero-egress, deterministic.

- Page: https://ainumbers.co/chaingraph/qfa-01-options-greeks.html
- Markdown twin: https://ainumbers.co/chaingraph/qfa-01-options-greeks.md
- MCP tool: compute_options_greeks (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- div_yield (number, required)
- expiry_days (number, required): Duration in days
- rate (number, required)
- spot (number, required)
- strike (number, required)
- type (unknown, required)
- vol (number, required)

## Outputs

- d1 (number, optional)
- d2 (number, optional)
- delta (number, optional)
- delta_risk_band (string, optional)
- gamma (number, optional)
- price (number, optional)
- rho_per_pct (number, optional)
- theta_per_day (number, optional)
- type (string, optional)
- vega_per_pct (number, optional)

## Sample

```json
{
  "spot": 100,
  "strike": 100,
  "expiry_days": 90,
  "vol": 20,
  "rate": 5,
  "div_yield": 0,
  "type": "call"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_options_greeks` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

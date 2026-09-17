# Portfolio VaR - Monte Carlo (Integer PRNG)

Monte Carlo portfolio Value-at-Risk and Expected Shortfall over a one-factor correlated-asset model. Integer-only xoshiro256** PRNG and fixed-point arithmetic run the full path simulation, so a declared seed replays byte-identically, and a tampered seed produces a different hash. Declares the SPEC.md §24.6.2 seeded-stochastic determinism class; the PRNG algorithm, seed, and draw count are carried in the receipt as ordinary inputs/outputs.

- Page: https://ainumbers.co/chaingraph/art-371-simulate-var-monte-carlo.html
- Markdown twin: https://ainumbers.co/chaingraph/art-371-simulate-var-monte-carlo.md
- MCP tool: simulate_var_monte_carlo (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- conf_level (unknown, required)
- correlation (unknown, optional)
- holding_period (unknown, optional)
- n_assets (unknown, optional)
- n_paths (unknown, optional)
- portfolio_value_mm (unknown, optional): Amount in millions
- seed (unknown, required)

## Outputs

- compliance_flags (array, optional)
- conf_level (number, optional)
- correlation (number, optional)
- draw_count (integer, optional)
- es_dollar_mm (number, optional)
- holding_period (integer, optional)
- mc_es_pct (number, optional)
- mc_var_pct (number, optional)
- n_assets (integer, optional)
- n_paths (integer, optional)
- prng_algorithm (string, optional)
- seed (integer, optional)
- var_dollar_mm (number, optional)
- verdict (string, optional)

## Sample

```json
{
  "seed": 42,
  "n_paths": 10000,
  "n_assets": 10,
  "holding_period": 10,
  "conf_level": 0.99,
  "correlation": 0.3,
  "portfolio_value_mm": 100
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_var_monte_carlo` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

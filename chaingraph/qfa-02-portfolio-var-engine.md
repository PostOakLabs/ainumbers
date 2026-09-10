# Portfolio Covariance & VaR Engine

VaR and Expected Shortfall: Historical Simulation, Parametric (variance-covariance), and Monte Carlo with Cholesky 2-factor correlation structure. P&L histogram (30 bins), 8×8 covariance heatmap. 500 assets, seeded LCG RNG. Buy-side zero-egress story.

- Page: https://ainumbers.co/chaingraph/qfa-02-portfolio-var-engine.html
- Markdown twin: https://ainumbers.co/chaingraph/qfa-02-portfolio-var-engine.md
- MCP tool: compute_portfolio_var (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- avg_correlation (unknown, required)
- conf_level (unknown, optional)
- confidence_level (unknown, required)
- correlation (unknown, optional)
- holding_period (unknown, optional)
- holding_period_days (unknown, required): Duration in days
- mc_sims (number, required)
- n_assets (number, optional)
- n_paths (unknown, optional)
- portfolio_value_mm (unknown, optional): Amount in millions
- seed (unknown, required)

## Outputs

- compliance_flags (array, optional)
- conf_level (number, optional)
- es_dollar_mm (number, optional)
- hist_var_pct (number, optional)
- holding_period (integer, optional)
- mc_es_pct (number, optional)
- mc_var_pct (number, optional)
- n_paths (integer, optional)
- param_es_pct (number, optional)
- param_var_pct (number, optional)
- portfolio_vol_hp (number, optional)
- var_dollar_mm (number, optional)
- verdict (string, optional)

## Sample

```json
{
  "n_assets": 2,
  "n_paths": 100,
  "conf_level": 0.975,
  "correlation": 0.3,
  "holding_period": 10,
  "seed": 42
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_portfolio_var` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

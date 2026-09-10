# Stress Test Engine

Multi-scenario stress testing across 6 historical crisis scenarios (GFC 2008, COVID Mar 2020, Dot-com Bust, Lehman Week, Rate Shock 2022, SVB Contagion 2023) with Monte Carlo per scenario. Equity/credit/rate factor decomposition, stressed VaR and ES, stress multiplier, recovery-day estimate. Chains from QFA-02 (VaR Engine). Feeds RCA-01 (FRTB IMA). Basel 3.1 Pillar 2 ICAAP / EBA GL/2018/04 / FRTB MAR30 stress calibration reference.

- Page: https://ainumbers.co/chaingraph/qfa-03-stress-test-engine.html
- Markdown twin: https://ainumbers.co/chaingraph/qfa-03-stress-test-engine.md
- MCP tool: compute_stress_test_scenarios (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confidence_level (unknown, required)
- credit_sensitivity (unknown, required)
- equity_beta (unknown, required)
- mc_paths (number, required)
- portfolio_vol (unknown, required)
- preset (unknown, required)
- rate_duration_yrs (unknown, required): Duration in years
- seed (unknown, required)

## Outputs

- compliance_flags (array, optional)
- max_drawdown (number, optional)
- normal_var_pct (number, optional)
- recovery_days_estimate (integer, optional)
- scenario_details (array, optional)
- scenario_losses (object, optional)
- stress_multiplier (number, optional)
- stressed_es_pct (number, optional)
- stressed_var_pct (number, optional)
- verdict (string, optional)
- warnings (array, optional)
- worst_case_loss (number, optional)
- worst_case_scenario (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_stress_test_scenarios` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

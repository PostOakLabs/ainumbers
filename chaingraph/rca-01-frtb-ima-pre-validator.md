# FRTB IMA Expected Shortfall Pre-Validator

FRTB IMA Expected Shortfall pre-validation: MC simulation across liquidity horizons LH1–LH5 (10/20/40/60/120 days), NMRF surcharge estimation, PLA Test (green/amber/red), IMA vs SA floor capital comparison. Educational pre-validator ahead of UK IMA go-live January 2028.

- Page: https://ainumbers.co/chaingraph/rca-01-frtb-ima-pre-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/rca-01-frtb-ima-pre-validator.md
- MCP tool: simulate_frtb_es (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confidenceLevel (number, required)
- nPositions (number, required)
- nRiskClasses (number, required)
- nScenarios (number, required)
- nmrfRate (number, required)
- seed (number, required)

## Outputs

- capital_ima (number, optional)
- capital_required (number, optional)
- confidence_level (number, optional)
- es_97_5_pct (number, optional)
- es_by_lh_class (array, optional)
- floor_binding (boolean, optional)
- n_positions (integer, optional)
- n_scenarios (integer, optional)
- nmrf_surcharge (integer, optional)
- pla_ratio (number, optional)
- pla_test_status (string, optional)
- sa_floor (number, optional)
- undiversified_es (number, optional)
- verdict (string, optional)

## Sample

```json
{
  "nPositions": 20,
  "nScenarios": 500,
  "confidenceLevel": 0.975,
  "nRiskClasses": 3,
  "nmrfRate": 0.05,
  "seed": 42
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_frtb_es` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

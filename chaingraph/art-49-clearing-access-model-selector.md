# Clearing Access Model Selector

Selects and costs the FICC access model - Direct vs Sponsored (done-with) vs Sponsored/Agent (done-away) - across cost, execution-access, margin/netting efficiency, and ops. Recommends a model with a CFO memo. Educational economics; not clearing advice.

- Page: https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.md
- MCP tool: model_clearing_access_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- capital_charge_rate (unknown, optional)
- capital_constrained (unknown, optional)
- cash_notional_annual (unknown, optional)
- collateral_in_lieu_eligible (unknown, optional)
- current_access (unknown, optional)
- firm_type (unknown, optional)
- im_funding_rate (unknown, optional)
- margin_segregation_pref (unknown, optional)
- num_executing_dealers (unknown, optional)
- pledged_collateral_value (unknown, optional)
- repo_notional_daily (unknown, optional)
- want_execution_flexibility (unknown, optional)

## Outputs

- annual_cost_by_model (object, optional)
- cfo_memo (string, optional)
- eligibility_gates (array, optional)
- execution_access_score (integer, optional)
- im_estimate_by_model (object, optional)
- model_scores (object, optional)
- netting_efficiency_pct (integer, optional)
- note (string, optional)
- recommended_model (string, optional)
- segregation_recommendation (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `model_clearing_access_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

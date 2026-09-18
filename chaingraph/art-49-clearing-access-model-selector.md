# Clearing Access Model Selector

Selects and costs the FICC access model - Direct vs Sponsored (done-with) vs Sponsored/Agent (done-away) - across cost, execution-access, margin/netting efficiency, and ops. Recommends a model with a CFO memo. Educational economics; not clearing advice.

- Page: https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-49-clearing-access-model-selector.md
- MCP tool: model_clearing_access_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- capital_charge_rate (any, optional): type not evidenced by kernel source
- capital_constrained (any, optional): type not evidenced by kernel source
- cash_notional_annual (any, optional): type not evidenced by kernel source
- collateral_in_lieu_eligible (any, optional): type not evidenced by kernel source
- current_access (any, optional): type not evidenced by kernel source
- firm_type (any, optional): type not evidenced by kernel source
- im_funding_rate (any, optional): type not evidenced by kernel source
- margin_segregation_pref (any, optional): type not evidenced by kernel source
- num_executing_dealers (any, optional): type not evidenced by kernel source
- pledged_collateral_value (any, optional): type not evidenced by kernel source
- repo_notional_daily (any, optional): type not evidenced by kernel source
- want_execution_flexibility (any, optional): type not evidenced by kernel source

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

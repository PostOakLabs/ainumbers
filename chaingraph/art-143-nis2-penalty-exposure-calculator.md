# NIS2 Penalty Exposure Calculator (Art. 34)

Calculate maximum NIS2 Art. 34 penalty exposure given entity classification, global annual turnover, and declared infringement types. Essential entities: max(€10M, 2% global turnover); important: max(€7M, 1.4%). Applies mitigating-factor reduction (10% per factor, floor 30% of max). Emits maximum penalty, turnover-pct exposure, and mitigated estimate. Terminal stage of nis2-entity-scope-and-obligations chain.

- Page: https://ainumbers.co/chaingraph/art-143-nis2-penalty-exposure-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-143-nis2-penalty-exposure-calculator.md
- MCP tool: calculate_nis2_penalty_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity_classification (unknown, optional)
- global_annual_turnover_eur (unknown, optional)
- infringement_types (unknown, optional)
- mitigating_factors (unknown, optional)

## Outputs

- entity_classification (string, optional)
- infringement_breakdown (array, optional)
- max_penalty_eur (integer, optional)
- mitigated_estimate_eur (integer, optional)
- mitigating_factors_applied (integer, optional)
- turnover_pct_exposure (integer, optional)

## Sample

```json
{
  "entity_classification": "essential",
  "global_annual_turnover_eur": 1000000000,
  "infringement_types": [
    "art21_measures_absent"
  ],
  "mitigating_factors": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_nis2_penalty_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

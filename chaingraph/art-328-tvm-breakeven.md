# Breakeven / CVP Analysis

Standard cost-volume-profit breakeven analysis: breakeven units and revenue from fixed costs, price per unit, and variable cost per unit, plus contribution margin ratio and an optional margin-of-safety calculation against a supplied current volume.

- Page: https://ainumbers.co/chaingraph/art-328-tvm-breakeven.html
- Markdown twin: https://ainumbers.co/chaingraph/art-328-tvm-breakeven.md
- MCP tool: compute_breakeven (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- current_units (number, optional)
- fixed_costs (number, optional)
- price_per_unit (number, optional)
- variable_cost_per_unit (number, optional)

## Outputs

- breakeven_revenue (integer, optional)
- breakeven_units (integer, optional)
- contribution_margin_ratio (number, optional)
- fixed_costs (integer, optional)
- margin_of_safety_pct (number, optional)
- margin_of_safety_units (integer, optional)
- note (string, optional)
- price_per_unit (integer, optional)
- regulatory_basis (string, optional)
- unit_contribution (integer, optional)
- variable_cost_per_unit (integer, optional)

## Sample

```json
{
  "fixed_costs": 50000,
  "price_per_unit": 25,
  "variable_cost_per_unit": 15,
  "current_units": 6000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_breakeven` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

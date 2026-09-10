# LCM Rate Derivation Calculator

Computes the Loss Cost Multiplier (LCM) and indicated insurance rate from user-supplied loss costs and expense/profit loadings. LCM = 1 / (1 - LAE% - fixed_exp% - variable_exp% - profit%). Indicated rate = loss_cost * LCM. Supports credibility-weighted blending of user's own loss costs with a complement. PROPRIETARY-DATA: this kernel performs LCM decomposition arithmetic ONLY on user-supplied loss costs - it NEVER embeds, redistributes, or references ISO/Verisk advisory loss cost rate pages (Verisk-proprietary). ASOP 25 compliant. ZERO PII: aggregate rate components only.

- Page: https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-255-compute-lcm-rate-derivation.md
- MCP tool: compute_lcm_rate_derivation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- complement_loss_cost (unknown, required)
- credibility_z (unknown, required)
- current_rate (unknown, required)
- fixed_expense_pct (unknown, required): Percentage value
- lae_pct (unknown, required): Percentage value
- profit_pct (unknown, required): Percentage value
- pure_loss_cost (unknown, required)
- variable_exp_pct (unknown, required): Percentage value

## Outputs

- complement_loss_cost (integer, optional)
- credibility_weighted_loss_cost (integer, optional)
- credibility_z (integer, optional)
- current_rate (string, optional)
- denominator_valid (boolean, optional)
- fixed_expense_pct (number, optional)
- indicated_rate (number, optional)
- issues (array, optional)
- lae_pct (number, optional)
- lcm (number, optional)
- lcm_denominator (number, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- profit_pct (number, optional)
- proprietary_data_notice (string, optional)
- pure_loss_cost (integer, optional)
- pure_loss_cost_loaded (number, optional)
- rate_change_direction (string, optional)
- rate_change_pct (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_loading (number, optional)
- variable_exp_pct (number, optional)

## Sample

```json
{
  "pure_loss_cost": 120,
  "lae_pct": 0.12,
  "fixed_expense_pct": 0.08,
  "variable_exp_pct": 0.1,
  "profit_pct": 0.05
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_lcm_rate_derivation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

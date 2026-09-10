# GloBE SBIE & Top-up Tax Calculator

Computes the OECD Pillar Two substance-based income exclusion (SBIE) for a jurisdiction from a caller-declared payroll-cost figure, tangible-asset carrying value, and a versioned transition-year rate table (payroll % + tangible-asset % looked up by target year, table supplied whole as a policy input - not hardcoded). Derives excess profit (jurisdictional GloBE income less SBIE, floored at zero), the resulting top-up tax from a caller-supplied top-up-tax percentage, and the final jurisdictional top-up after a QDMTT-paid offset, flagging any QDMTT over-collection informationally. Consumes art-454's jurisdictional GloBE income + top-up-tax-percentage output shape directly and does not recompute an ETR itself, so it also runs standalone. Election choices and GloBE-income adjustments are human judgment and stay upstream. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-455-globe-sbie-topup.html
- Markdown twin: https://ainumbers.co/chaingraph/art-455-globe-sbie-topup.md
- MCP tool: compute_globe_sbie_topup (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- globe_income (unknown, required)
- payroll_costs (unknown, required)
- policy_rate_table (array, required)
- qdmtt_paid (unknown, required)
- tangible_asset_carrying_value (unknown, required)
- target_year (unknown, required)
- top_up_tax_percentage (unknown, required)

## Outputs

- excess_profit (integer, optional)
- globe_income (integer, optional)
- jurisdictional_top_up (integer, optional)
- payroll_component (integer, optional)
- payroll_rate (number, optional)
- qdmtt_over_collection (boolean, optional)
- qdmtt_paid (integer, optional)
- rate_row_found (boolean, optional)
- sbie (integer, optional)
- tangible_asset_component (integer, optional)
- tangible_asset_rate (number, optional)
- target_year (integer, optional)
- top_up_tax (integer, optional)
- top_up_tax_percentage (number, optional)

## Sample

```json
{
  "payroll_costs": 10000000,
  "tangible_asset_carrying_value": 20000000,
  "target_year": 2025,
  "policy_rate_table": [
    {
      "year": 2024,
      "payroll_rate": 0.1,
      "tangible_asset_rate": 0.08
    },
    {
      "year": 2025,
      "payroll_rate": 0.096,
      "tangible_asset_rate": 0.074
    },
    {
      "year": 2026,
      "payroll_rate": 0.092,
      "tangible_asset_rate": 0.068
    }
  ],
  "globe_income": 5000000,
  "top_up_tax_percentage": 0.03,
  "qdmtt_paid": 20000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_globe_sbie_topup` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

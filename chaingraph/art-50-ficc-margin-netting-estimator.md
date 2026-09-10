# FICC Margin & Netting Estimator

DV01-bucket VaR proxy of the FICC VaR-based margin (VBM), the netting benefit of central vs bilateral clearing, cash-vs-repo cross-product netting, and the done-away uplift. Educational proxy - not the official FICC VBM calculator.

- Page: https://ainumbers.co/chaingraph/art-50-ficc-margin-netting-estimator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-50-ficc-margin-netting-estimator.md
- MCP tool: estimate_ficc_margin_netting (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- clearing_model (unknown, optional)
- confidence_level (unknown, optional)
- include_cross_product (unknown, optional)
- mpor_days (unknown, optional): Duration in days
- positions (unknown, optional)

## Outputs

- assumptions (object, optional)
- done_away_uplift_pct (integer, optional)
- estimated_vbm (integer, optional)
- gross_bilateral_im (integer, optional)
- margin_by_bucket (array, optional)
- minimum_charge_applied (boolean, optional)
- net_cleared_im (integer, optional)
- netting_benefit_pct (integer, optional)
- netting_benefit_usd (integer, optional)
- note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_ficc_margin_netting` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

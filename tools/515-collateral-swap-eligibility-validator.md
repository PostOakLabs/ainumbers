# Collateral Swap Eligibility Validator

Validate collateral swaps under GMSLA/GMRA with SFTR Article 15 reuse constraints. HQLA upgrade and downgrade impact analysis. Canton settlement of collateral swap legs.

- Page: https://ainumbers.co/tools/515-collateral-swap-eligibility-validator.html
- Markdown twin: https://ainumbers.co/tools/515-collateral-swap-eligibility-validator.md
- MCP tool: validate_collateral_swap_eligibility (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_a (any, optional): type not evidenced by kernel source
- asset_b (any, optional): type not evidenced by kernel source
- counterparty_jurisdiction (any, optional): type not evidenced by kernel source
- declared_direction (any, optional): type not evidenced by kernel source
- governing_agreement (any, optional): type not evidenced by kernel source
- haircut_a (any, optional): type not evidenced by kernel source
- haircut_b (any, optional): type not evidenced by kernel source
- notional_a (any, optional): type not evidenced by kernel source
- notional_b (any, optional): type not evidenced by kernel source
- provider_informed (any, optional): type not evidenced by kernel source
- reuse_flag (any, optional): type not evidenced by kernel source
- sftr_consent (any, optional): type not evidenced by kernel source

## Outputs

- eligibility (string, required)
- hqla_impact (string, required)
- hqla_tier_a (string, required)
- hqla_tier_b (string, required)
- net_economic_value (number, required)
- pacs008 (object, required)
- value_a (number, required)
- value_b (number, required)

## Sample

```json
{
  "asset_a": "ig_corp_bond",
  "asset_b": "ust",
  "notional_a": 1000000,
  "notional_b": 950000,
  "haircut_a": 50,
  "haircut_b": 0,
  "declared_direction": "UPGRADE",
  "governing_agreement": "gmra",
  "reuse_flag": false,
  "sftr_consent": false,
  "provider_informed": false,
  "counterparty_jurisdiction": "us"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_collateral_swap_eligibility` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

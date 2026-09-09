# Tokenized Fund Collateral Validator

Validate MMF/CNAV/LVNAV/VNAV fund shares as collateral against SEC Rule 2a-7 (post-2023 reforms), EU MMFR, and Basel HQLA exclusion criteria. Canton/Benji tokenized fund collateral assessment.

- Page: https://ainumbers.co/tools/514-tokenized-fund-collateral-validator.html
- Markdown twin: https://ainumbers.co/tools/514-tokenized-fund-collateral-validator.md
- MCP tool: validate_fund_collateral (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collateral_use (unknown, optional)
- cp_jurisdiction (unknown, optional)
- daily_liquid_assets_pct (unknown, optional): Percentage value
- fund_type (unknown, optional)
- nav (unknown, optional)
- platform (unknown, optional)
- reuse_flag (unknown, optional)
- sftr_consent (unknown, optional)
- total_fund_value (unknown, optional)
- weekly_liquid_assets_pct (unknown, optional): Percentage value

## Outputs

- adjusted_collateral_value (number, required)
- eligibility (string, required)
- haircut_applied (number, required)
- hqla_tier (string, required)

## Sample

```json
{
  "fund_type": "sec_govt_mmf",
  "total_fund_value": 1000000,
  "daily_liquid_assets_pct": 30,
  "weekly_liquid_assets_pct": 60,
  "nav": 1,
  "collateral_use": "lender_collateral",
  "platform": "canton_benji",
  "sftr_consent": true,
  "reuse_flag": false,
  "provider_informed": true,
  "cp_jurisdiction": "us"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_fund_collateral` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

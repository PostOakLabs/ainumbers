# Tokenized Collateral Eligibility Checker

Classify tokenized assets for DTC/Fed eligibility and Basel HQLA tier (L1/L2A/L2B/non-HQLA). Shared eligibility layer consumed by DvP, repo, margin, and fund workflows. BCBS d349/SCO60.

- Page: https://ainumbers.co/tools/505-tokenized-collateral-eligibility-checker.html
- Markdown twin: https://ainumbers.co/tools/505-tokenized-collateral-eligibility-checker.md
- MCP tool: check_tokenized_collateral_eligibility (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_type (string, required): Asset class. mmf_fund_share → always NON_HQLA (BCBS LCR paras 50–54 exhaustive list).
- notional (number, required): Face / notional amount in stated currency.
- currency (string, required)
- platform (string, optional): On-chain settlement platform. Canton + DTC required for DTC_ELIGIBLE USTs.
- custody_linkage (string, optional)
- transfer_restrictions (array, optional): Any restriction present adds +5% to HQLA haircut.

## Outputs

- dtc_status (string, optional)
- hqla_tier (string, optional)
- final_haircut_pct (number, optional)
- adjusted_value (number, optional)
- compliance_flags (object, optional)
- mandate_type (string, optional)

## Sample

```json
{
  "asset_type": "ust",
  "notional": 1000000,
  "transfer_restrictions": {},
  "custody_linkage": "dtc"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_tokenized_collateral_eligibility` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

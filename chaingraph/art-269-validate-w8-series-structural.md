# W-8 Series Structural Validator

Validates W-8 series form structural consistency for withholding tax compliance. Checks: form-type/Chapter 3 status compatibility (FORM_CH3_MISMATCH for W-8BEN-E + Individual mismatch etc.), Chapter 3/Chapter 4 FATCA cross-check (CH3_CH4_INCONSISTENT), 3-year validity window expiring Dec 31 of third year per Treas. Reg. 1.1441-1(e)(4)(ii) (FORM_EXPIRED), and treaty dividend rate against IRS Pub 901 table (TREATY_RATE_MISMATCH). Returns is_structurally_valid, violations[], validity_expiry_date, and days_until_expiry. Structural form codes only. No TIN. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/art-269-validate-w8-series-structural.html
- Markdown twin: https://ainumbers.co/chaingraph/art-269-validate-w8-series-structural.md
- MCP tool: validate_w8_series_structural (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chapter3_status (unknown, optional)
- chapter4_fatca_status (unknown, optional)
- form_date (unknown, optional)
- form_type (unknown, optional)
- income_type (unknown, optional)
- reference_date (unknown, optional)
- treaty_country (unknown, optional)
- treaty_rate_pct (unknown, optional): Percentage value

## Outputs

- ch3_ch4_consistent (boolean, optional)
- chapter3_status (string, optional)
- chapter4_fatca_status (string, optional)
- days_until_expiry (integer, optional)
- form_ch3_compatible (boolean, optional)
- form_type (string, optional)
- is_structurally_valid (boolean, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- statutory_withholding_rate_pct (integer, optional)
- table_source (string, optional)
- table_version (string, optional)
- treaty_country (string, optional)
- treaty_rate_expected (integer, optional)
- treaty_rate_pct (integer, optional)
- treaty_rate_valid (boolean, optional)
- validity_expiry_date (string, optional)
- validity_window_ok (boolean, optional)
- violation_count (integer, optional)
- violations (array, optional)

## Sample

```json
{
  "form_type": "W-8BEN",
  "chapter3_status": "Individual",
  "chapter4_fatca_status": "",
  "treaty_country": "GB",
  "treaty_rate_pct": 15,
  "income_type": "Dividend",
  "form_date": "2024-03-15",
  "reference_date": "2025-07-05"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_w8_series_structural` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

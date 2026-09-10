# EMIR Trade Report Field Validator

Validate the required-field subset of an EMIR Refit ISO 20022 auth.030 derivative trade report: action type, both counterparty LEIs (20-char ISO 17442), UTI, UPI, notional, currency, effective date, and asset class. Catches missing or malformed fields before submission to the Trade Repository. Feeds UTI completeness checker (art-154).

- Page: https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-153-emir-trade-report-field-validator.md
- MCP tool: validate_emir_trade_report (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "report": {
    "action_type": "New",
    "reporting_counterparty_lei": "MAES062Z21O4RZ2U7M96",
    "other_counterparty_lei": "7LTWFZYICNSX8D621K86",
    "uti": "UTI-EXAMPLE-001-20240429",
    "upi": "DJMM0VX7HY4A",
    "notional": 1000000,
    "notional_currency": "EUR",
    "effective_date": "2024-04-29",
    "asset_class": "IR"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_emir_trade_report` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

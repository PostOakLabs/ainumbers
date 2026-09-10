# EMIR UPI Validator

Validate EMIR Refit UPI format (ISO 4914, 12-character alphanumeric via ANNA Derivatives Service Bureau) and product classification consistency: asset class must be a supported EMIR class (IR/CR/EQ/CO/FX) and instrument type must be present. Terminal node of the emir-trade-report-validation chain; exports field-level validity verdict with execution_hash.

- Page: https://ainumbers.co/chaingraph/art-155-emir-upi-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-155-emir-upi-validator.md
- MCP tool: validate_emir_upi (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "upi": "DJMM0VX7HY4A",
  "asset_class": "IR",
  "instrument_type": "IRS"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_emir_upi` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

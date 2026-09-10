# Tokenized Security Lifecycle Validator

Validate Daml lifecycle coverage for tokenized securities: issuance, coupon/dividend, corporate actions (splits, mergers), and maturity/redemption events. EU DLT Pilot Regime and MiFID II compliance.

- Page: https://ainumbers.co/tools/512-tokenized-security-lifecycle-validator.html
- Markdown twin: https://ainumbers.co/tools/512-tokenized-security-lifecycle-validator.md
- MCP tool: validate_tokenized_security_lifecycle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- covered_events (unknown, optional)
- custodian_type (unknown, optional)
- daml_lifecycle_defined (unknown, optional)
- isin_assigned (unknown, optional)
- issuance_amount (unknown, optional)
- jurisdiction (unknown, optional)
- prospectus_filed (unknown, optional)
- security_type (unknown, optional)

## Outputs

- all_gaps (array, required)
- critical_gaps (array, required)
- event_matrix (object, required)
- verdict (string, required)
- verdict_badge (string, required)

## Sample

```json
{
  "security_type": "ust",
  "jurisdiction": "us",
  "issuance_amount": 1000000,
  "isin_assigned": true,
  "daml_lifecycle_defined": true,
  "custodian_type": "qualified_custodian",
  "covered_events": [
    "issuance",
    "coupon_payment",
    "maturity_redemption"
  ],
  "prospectus_filed": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_tokenized_security_lifecycle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

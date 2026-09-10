# EUDR DDS Field Validator

Validate the required-field subset of an EUDR Due Diligence Statement (DDS) before TRACES NT filing: operator name, address, EORI, HS code, trade name, quantity, country of production, and geolocation indicator (or micro-operator postal-address exemption). Returns conformant verdict and missing-field list. Root node of the eudr-due-diligence-statement-validation chain. Zero network, zero PII. Reg. EU 2023/1115, mandatory 2026-12-30 (large/medium) / 2027-06-30 (SME).

- Page: https://ainumbers.co/chaingraph/art-165-eudr-dds-field-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-165-eudr-dds-field-validator.md
- MCP tool: validate_eudr_due_diligence_statement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- dds (unknown, optional)

## Outputs

- conformant (boolean, optional)
- country_of_production (string, optional)
- fields_checked (integer, optional)
- fields_passed (integer, optional)
- micro_operator_exemption (boolean, optional)
- missing_fields (array, optional)
- quantity (integer, optional)

## Sample

```json
{
  "dds": {
    "operator_name": "Amazon Timber GmbH",
    "operator_address": "Industriestr. 12, 10115 Berlin, DE",
    "eori": "DE123456789012",
    "hs_code": "4407",
    "trade_name": "Tropical Sawn Timber",
    "quantity": 5000,
    "country_of_production": "BR",
    "geolocation_present": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_eudr_due_diligence_statement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

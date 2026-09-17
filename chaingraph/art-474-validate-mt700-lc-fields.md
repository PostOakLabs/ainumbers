# MT700 LC Field Validator

Validates SWIFT MT700 Documentary Credit field-format and date-logic conformance against UCP 600 / MT700 mandatory-field rules: DC number, form of credit, issue/expiry/shipment dates, currency and amount, availability terms, shipment terms, goods description, documents required, presentation period, and party fields. Returns a weighted compliance score, field-by-field findings, and article citations. Provable node counterpart to tools/420-mt700-lc-field-validator.html; the tool page's Presented Documents discrepancy check (UCP 600 R01-R14) stays browser-only.

- Page: https://ainumbers.co/chaingraph/art-474-validate-mt700-lc-fields.html
- Markdown twin: https://ainumbers.co/chaingraph/art-474-validate-mt700-lc-fields.md
- MCP tool: validate_mt700_lc_fields (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- fields (unknown, required)

## Outputs

- compliant (boolean, optional)
- error_count (integer, optional)
- errors (array, optional)
- field_results (array, optional)
- score (integer, optional)
- verdict (string, optional)
- warning_count (integer, optional)
- warnings (array, optional)

## Sample

```json
{
  "fields": {
    "field_20": "LC2024/001234",
    "field_40A": "IRREVOCABLE",
    "field_31C": "260901",
    "field_31D_date": "261231",
    "field_31D_place": "LONDON, UNITED KINGDOM",
    "field_32B": "USD 500000.00",
    "field_41_bank": "ANY BANK",
    "field_41_by": "BY NEGOTIATION",
    "field_42": "",
    "field_43P": "ALLOWED",
    "field_43T": "NOT ALLOWED",
    "field_44A": "SHANGHAI, CHINA",
    "field_44B": "ROTTERDAM, NETHERLANDS",
    "field_44C": "261201",
    "field_45A": "ELECTRONIC COMPONENTS AS PER PROFORMA INVOICE NO. PI-2024-001, CIF ROTTERDAM",
    "field_46A": "SIGNED COMMERCIAL INVOICE IN TRIPLICATE\nFULL SET CLEAN ON BOARD BILLS OF LADING\nPACKING LIST IN TRIPLICATE\nCERTIFICATE OF ORIGIN",
    "field_48": "21",
    "field_49": "CONFIRM",
    "field_50": "ABC IMPORT CO, 123 MAIN ST, NEW YORK",
    "field_59": "XYZ EXPORT LTD, 45 HARBOUR RD, SHANGHAI"
  },
  "as_of_date": "260801"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_mt700_lc_fields` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

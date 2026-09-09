# E-Invoice Format Validator

Conformance-validate a structured e-invoice extract against version-pinned Factur-X, XRechnung, PINT-AE, MyInvois, Peppol BIS 3.0/EN 16931 core (Belgium), or KSeF FA(3) (Poland) format rules: mandatory-field presence, currency/VAT-category codelist membership, line-item cardinality. Returns per-rule findings, missing_fields, and structural_completeness. Root node of the einvoice-validation-pipeline chain. Zero network, zero PII. Not a legal-validity determination.

- Page: https://ainumbers.co/chaingraph/art-293-einvoice-format-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-293-einvoice-format-validator.md
- MCP tool: validate_einvoice_format (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- document (unknown, required)

## Outputs

- findings (array, optional)
- format (string, optional)
- line_item_count (integer, optional)
- missing_fields (array, optional)
- parse_error (string, optional)
- rule_set_version (string, optional)
- structural_completeness (boolean, optional)

## Sample

```json
{
  "document": {
    "format": "xrechnung",
    "document_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "embedded_xml_sha256": null,
    "fields": {
      "invoice_number": "INV-1",
      "invoice_date": "2026-09-15",
      "currency_code": "EUR",
      "seller_name": "Acme GmbH",
      "seller_vat_id": "DE123456789",
      "buyer_name": "Buyer SAS",
      "leitweg_id": "04011000-12345-67"
    },
    "line_items": [
      {
        "line_id": 1,
        "net_amount": 1000,
        "vat_category": "S",
        "vat_rate_pct": 19
      },
      {
        "line_id": 2,
        "net_amount": 500,
        "vat_category": "Z",
        "vat_rate_pct": 0
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_einvoice_format` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

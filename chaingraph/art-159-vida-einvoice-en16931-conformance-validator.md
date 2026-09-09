# ViDA EN 16931 E-Invoice Conformance Validator

Validate a structured e-invoice against EN 16931-1:2026 mandatory field requirements for ViDA Digital Reporting Requirements. Checks invoice_number, invoice_date, currency_code, seller_name, buyer_name, seller_vat_id, syntax_id, vat_breakdown, and total_with_vat. Returns conformance verdict and missing-field list. Root node of the vida-digital-reporting-requirements chain. Zero network, zero PII. EU 2025/516, mandatory 2030-07-01.

- Page: https://ainumbers.co/chaingraph/art-159-vida-einvoice-en16931-conformance-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-159-vida-einvoice-en16931-conformance-validator.md
- MCP tool: validate_vida_einvoice_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "invoice": {
    "invoice_number": "INV-2030-001",
    "invoice_date": "2030-08-15",
    "currency_code": "EUR",
    "seller_name": "Acme GmbH",
    "buyer_name": "Bayer AG",
    "seller_vat_id": "DE123456789",
    "syntax_id": "urn:cen.eu:en16931:2017",
    "vat_breakdown": [
      {
        "category_code": "S"
      }
    ],
    "total_with_vat": 1190
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_vida_einvoice_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

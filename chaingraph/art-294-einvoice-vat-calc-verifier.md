# E-Invoice VAT Calculation Verifier

Recompute an e-invoice's line VAT, per-category tax subtotals, tax total, and grand total from its line items under a supplied rounding convention, then compare against the document-asserted amounts. Reverse-charge and zero-rate categories are treated as zero VAT. Verifies arithmetic consistency only, not statutory rate correctness. Middle node of the einvoice-validation-pipeline chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-294-einvoice-vat-calc-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-294-einvoice-vat-calc-verifier.md
- MCP tool: verify_einvoice_vat_calc (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- document (unknown, required)
- rounding (unknown, required)

## Outputs

- consistent (boolean, optional)
- grand_total_computed (integer, optional)
- grand_total_delta (integer, optional)
- parse_error (string, optional)
- rounding (object, optional)
- subtotal_deltas (array, optional)
- tax_total_computed (integer, optional)
- tax_total_delta (integer, optional)

## Sample

```json
{
  "document": {
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
    ],
    "tax_subtotals_asserted": [
      {
        "vat_category": "S",
        "vat_rate_pct": 19,
        "taxable_amount": 1000,
        "tax_amount": 190
      },
      {
        "vat_category": "Z",
        "vat_rate_pct": 0,
        "taxable_amount": 500,
        "tax_amount": 0
      }
    ],
    "grand_total_asserted": 1690,
    "tax_total_asserted": 190
  },
  "rounding": {
    "method": "half-up",
    "granularity": "per-line"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_einvoice_vat_calc` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

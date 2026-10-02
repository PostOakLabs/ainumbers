# Three Way Invoice Match

Matches one invoice against its purchase order and its goods receipt and decides whether the invoice can be paid: every invoice line is paired to an unused PO line by the declared po_line, then by exact sku, then by a free same-number PO line (no fuzzy text matching anywhere), and each paired line takes the first verdict that applies in a fixed order: quantity over received, receipt missing (a two-way match, reported as a flag rather than a failure), quantity over ordered, or unit price outside the declared basis-point tolerance, where a variance exactly at the tolerance passes. Totals are recomputed in integer minor units: the line sum against the declared subtotal, tax from one declared rate under half-up integer rounding, and the total from those two. Prior invoices from the same vendor are screened for duplicates on same total inside the declared day window, the same normalized invoice number (lowercased, non-alphanumerics stripped, leading letters and zeros stripped), or the same PO, with the likely-duplicate rule fixed in advance. Any of fractional quantities, sub-minor-unit prices, negative or non-integer money, duplicate line numbers, an unknown tax rounding, or a missing currency is refused with a named reason, never rounded or coerced. Scope limits: one currency per invoice, one declared tax rate with no tax-jurisdiction logic, and day differences from integer days-from-civil arithmetic with no clock; no goods receipt at all downgrades the run to a two-way match and is reported, not failed.

- Page: https://ainumbers.co/chaingraph/art-701-three-way-invoice-match.html
- Markdown twin: https://ainumbers.co/chaingraph/art-701-three-way-invoice-match.md
- MCP tool: match_invoice_three_way (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- currency (string, required)
- invoice (object, required)
- purchase_order (object, optional)
- goods_receipt (object, optional)
- vendor_terms (object, required)
- prior_invoices (array, optional)
- duplicate_window_days (integer, required)

## Outputs

- outcome (string, optional)
- refusal_reason (string, optional)
- po_number (string,null, optional)
- receipt_id (string,null, optional)
- lines (array, optional)
- totals (object,null, optional)
- mismatches (array, optional)
- duplicates (array, optional)
- domain_errors (array, optional)
- hold_recommended (boolean, optional)
- scope_note (string, optional)

## Sample

```json
{
  "currency": "USD",
  "invoice": {
    "invoice_number": "INV-0042",
    "issue_date": "2026-09-30",
    "vendor_id": "V-1",
    "po_number": "PO-7",
    "subtotal_minor": 170000,
    "tax_minor": 14025,
    "total_minor": 184025,
    "lines": [
      {
        "line": 1,
        "po_line": 1,
        "sku": "A-100",
        "qty": 10,
        "unit_price_minor": 12000,
        "amount_minor": 120000
      },
      {
        "line": 2,
        "po_line": 2,
        "sku": "B-200",
        "qty": 5,
        "unit_price_minor": 4000,
        "amount_minor": 20000
      },
      {
        "line": 3,
        "po_line": 3,
        "sku": "C-300",
        "qty": 2,
        "unit_price_minor": 15000,
        "amount_minor": 30000
      }
    ]
  },
  "purchase_order": {
    "po_number": "PO-7",
    "lines": [
      {
        "line": 1,
        "sku": "A-100",
        "qty": 10,
        "unit_price_minor": 12000
      },
      {
        "line": 2,
        "sku": "B-200",
        "qty": 5,
        "unit_price_minor": 4000
      },
      {
        "line": 3,
        "sku": "C-300",
        "qty": 2,
        "unit_price_minor": 15000
      }
    ]
  },
  "goods_receipt": {
    "receipt_id": "GR-3",
    "lines": [
      {
        "po_line": 1,
        "qty_received": 10
      },
      {
        "po_line": 2,
        "qty_received": 5
      },
      {
        "po_line": 3,
        "qty_received": 2
      }
    ]
  },
  "vendor_terms": {
    "price_tolerance_bp": 200,
    "tax_rate_bp": 825,
    "tax_rounding": "half_up"
  },
  "prior_invoices": [],
  "duplicate_window_days": 14
}
```

## Verify

Run the sample policy_parameters through MCP tool `match_invoice_three_way` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

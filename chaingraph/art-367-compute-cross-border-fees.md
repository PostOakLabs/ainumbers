# Cross-Border B2B Fee Calculator

Itemizes a single cross-border B2B invoice's total cost stack: FX spread cost, payment-method/correspondent fee, VAT or reverse-charge cost, documentary-credit cost, and reconciliation cost, plus total cost as a percentage of invoice value. Ports the calculation from tools/141-cross-border-b2b-fee-calculator.html into a provable kernel. VAT treatment, documentary-credit cost, and correspondent fees are caller-supplied, never vendored. Pairs with the already-shipped compare_corridor_cost node (art-249), which benchmarks a remittance corridor against World Bank RPW / SDG 10.c targets rather than itemizing a single invoice.

- Page: https://ainumbers.co/chaingraph/art-367-compute-cross-border-fees.html
- Markdown twin: https://ainumbers.co/chaingraph/art-367-compute-cross-border-fees.md
- MCP tool: compute_cross_border_fees (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- dest_country (unknown, required)
- doc_cost (number, optional)
- fx_spread_bps (number, optional): Amount in basis points
- invoice_amount (number, optional)
- method_fee (number, optional)
- origin_country (unknown, required)
- recon_cost (number, optional)
- vat_rate (number, optional)

## Outputs

- dest_country (string, optional)
- disambiguation (string, optional)
- doc_cost (integer, optional)
- fx_cost (number, optional)
- fx_spread_bps (integer, optional)
- invoice_amount (integer, optional)
- method_fee (integer, optional)
- origin_country (string, optional)
- pct_of_invoice (number, optional)
- recon_cost (integer, optional)
- regulatory_basis (string, optional)
- total_cost (number, optional)
- vat_cost (integer, optional)
- vat_rate (integer, optional)

## Sample

```json
{
  "invoice_amount": 85000,
  "origin_country": "US",
  "dest_country": "GB",
  "fx_spread_bps": 75,
  "method_fee": 35,
  "vat_rate": 0,
  "doc_cost": 0,
  "recon_cost": 12
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_cross_border_fees` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

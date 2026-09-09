# ViDA Platform Deemed Supplier Classifier

Classify a digital platform as a ViDA deemed supplier under Art. 46a (amended VAT Directive): short-term accommodation (≤30 consecutive nights) or intra-EU road passenger transport where the underlying supplier has no valid VAT ID causes VAT liability to transfer to the platform. Returns deemed_supplier verdict, sector_eligible, and applicable deadline (mandatory 2028-07-01, MS extension option 2030-01-01). Root node of the vida-platform-and-registration chain. Zero network, zero PII. EU 2025/516.

- Page: https://ainumbers.co/chaingraph/art-162-vida-platform-deemed-supplier-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-162-vida-platform-deemed-supplier-classifier.md
- MCP tool: classify_vida_platform_deemed_supplier (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "platform": {
    "sector": "short_term_accommodation",
    "duration_nights": 3,
    "supplier_has_valid_vat_id": false,
    "intra_eu_supply": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_vida_platform_deemed_supplier` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

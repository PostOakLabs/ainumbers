# ViDA DRR Transaction Reporter

Assess whether an intra-EU B2B transaction falls within the ViDA Digital Reporting Requirements scope and calculate the 10-calendar-day reporting deadline. Checks supply_type (B2B), distinct seller/buyer member states, valid VAT IDs on both sides, and transaction_value completeness. Returns in_scope, reporting_deadline, and completeness gaps. Middle node of the vida-digital-reporting-requirements chain. Zero network, zero PII. EU 2025/516, mandatory 2030-07-01.

- Page: https://ainumbers.co/chaingraph/art-160-vida-drr-transaction-reporter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-160-vida-drr-transaction-reporter.md
- MCP tool: assess_vida_drr_reporting_obligation (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "transaction": {
    "supply_type": "B2B",
    "seller_member_state": "DE",
    "buyer_member_state": "FR",
    "seller_vat_id": "DE123456789",
    "buyer_vat_id": "FR98765432100",
    "invoice_date": "2030-08-01",
    "transaction_value": 50000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_vida_drr_reporting_obligation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# ViDA Recapitulative Statement Migration Assessor

Assess an entity's readiness to migrate from EC Sales List (recapitulative statements) to ViDA Digital Reporting Requirements. Checks presence of four ESL fields (seller_vat_id, buyer_vat_id, reporting_period, supply_type), pre-2024 domestic regime flag (harmonization deadline: 2030-07-01 for new regimes, 2035-01-01 for legacy), and transaction_value completeness. Returns migration_ready, drr_gap_fields, and harmonize_deadline. Terminal node of the vida-digital-reporting-requirements chain. Zero network, zero PII. EU 2025/516.

- Page: https://ainumbers.co/chaingraph/art-161-vida-recapitulative-statement-migration-assessor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-161-vida-recapitulative-statement-migration-assessor.md
- MCP tool: assess_vida_recapitulative_migration (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "regime": {
    "pre2024_domestic": false,
    "seller_vat_id": "DE123456789",
    "buyer_vat_id": "FR98765432100",
    "reporting_period": "2030-Q3",
    "supply_type": "B2B",
    "transaction_value": 50000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_vida_recapitulative_migration` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

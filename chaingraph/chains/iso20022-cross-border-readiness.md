# ISO 20022 Cross-Border Readiness

pacs.008 cross-border message generation > ISO20022 message validation > ISO20022 migration navigator: composite ISO20022 cross-border readiness mandate.

- Page: https://ainumbers.co/chaingraph/chains/iso20022-cross-border-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/iso20022-cross-border-readiness.md

## Workflow chain: ISO 20022 Cross-Border Readiness

pacs.008 cross-border message generation > ISO20022 message validation > ISO20022 migration navigator: composite ISO20022 cross-border readiness mandate.

Domain: Cross-Border & Instant Payments

### Steps

1. 219-pacs008-cross-border-generator
   pacs008_message and field_population_status feed Stage 2 ISO20022 validation
2. 248-iso20022-validator
   validation_errors and schema_compliance feed Stage 3 ISO20022 migration navigator
3. 81-iso20022-migration-navigator
   migration_gaps and cutover_plan - final ISO20022 cross-border readiness mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# ISO 20022 Cutover

Truncation audit > migration score > cross-rail compatibility check.

- Page: https://ainumbers.co/chaingraph/chains/iso20022-cutover.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/iso20022-cutover.md

## Workflow chain: ISO 20022 Cutover

Truncation audit > migration score > cross-rail compatibility check.

Domain: Cross-Border & Instant Payments

### Steps

1. 77-iso-truncation-auditor
   truncation_risks and field_map feed Stage 2 migration scoring
2. 101-iso20022-migration-scorer
   migration_score and readiness_flags feed Stage 3 cross-rail check
3. 254-iso20022-cross-rail-compatibility
   Exports ISO 20022 cutover Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

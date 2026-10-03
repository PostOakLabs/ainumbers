# ViDA Digital Reporting Requirements

Validate EN 16931-1:2026 structured e-invoice conformance (art-159) -> assess intra-EU B2B DRR scope and 10-calendar-day reporting deadline (art-160) -> assess EC Sales List to DRR migration readiness and harmonization deadline (art-161). Full ViDA digital reporting pipeline. EU 2025/516, mandatory 2030-07-01.

- Page: https://ainumbers.co/chaingraph/chains/vida-digital-reporting-requirements.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/vida-digital-reporting-requirements.md

## Workflow chain: ViDA Digital Reporting Requirements

Validate EN 16931-1:2026 structured e-invoice conformance (art-159) -> assess intra-EU B2B DRR scope and 10-calendar-day reporting deadline (art-160) -> assess EC Sales List to DRR migration readiness and harmonization deadline (art-161). Full ViDA digital reporting pipeline. EU 2025/516, mandatory 2030-07-01.

Domain: ViDA / E-Invoicing

### Steps

1. art-159-vida-einvoice-en16931-conformance-validator
   EN 16931 conformance feeds DRR obligation assessor
2. art-160-vida-drr-transaction-reporter
   DRR scope and 10-day deadline feeds migration assessor
3. art-161-vida-recapitulative-statement-migration-assessor
   Exports ESL-to-DRR migration verdict and harmonization deadline with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Digital reporting of e-invoices arrives in 2030. Is the transaction data we exchange today already fit to report under it?
Run the AINumbers MCP tool `run_chain` with {"chain":"vida-digital-reporting-requirements"} and read `art-161-vida-recapitulative-statement-migration-assessor.migration_ready`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/vida-digital-reporting-requirements.html

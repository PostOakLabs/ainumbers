# EUDR Due Diligence Statement Validation

Validate EUDR DDS required fields and EORI (art-165) -> validate GeoJSON plot geolocation against size rules and coordinate validity (art-166) -> classify HS code to EUDR Annex I commodity scope and determine operator role, deadline, and obligations (art-167). Full DDS pre-submission validation pipeline. Reg. EU 2023/1115, mandatory 2026-12-30 (large/medium) / 2027-06-30 (SME).

- Page: https://ainumbers.co/chaingraph/chains/eudr-due-diligence-statement-validation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eudr-due-diligence-statement-validation.md

## Workflow chain: EUDR Due Diligence Statement Validation

Validate EUDR DDS required fields and EORI (art-165) -> validate GeoJSON plot geolocation against size rules and coordinate validity (art-166) -> classify HS code to EUDR Annex I commodity scope and determine operator role, deadline, and obligations (art-167). Full DDS pre-submission validation pipeline. Reg. EU 2023/1115, mandatory 2026-12-30 (large/medium) / 2027-06-30 (SME).

Domain: EUDR

### Steps

1. art-165-eudr-dds-field-validator
   DDS field conformance feeds geolocation validator
2. art-166-eudr-geolocation-plot-validator
   Plot geolocation validity feeds commodity scope classifier
3. art-167-eudr-commodity-scope-classifier
   Exports commodity scope, obligations, and deadline with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

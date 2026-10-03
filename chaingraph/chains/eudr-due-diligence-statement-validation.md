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

### Ask your agent

Question: The broker reclassified this consignment under a new HS line. Does it now fall inside EUDR scope with a DDS filing obligation?
Run the AINumbers MCP tool `run_chain` with {"chain":"eudr-due-diligence-statement-validation"} and read `art-167-eudr-commodity-scope-classifier.dds_filing_required`.
Re-run with `inputs` for `art-167-eudr-commodity-scope-classifier`, reusing the values that result echoed, with `hs_code` set to "7404". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/eudr-due-diligence-statement-validation.html

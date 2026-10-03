# ACA 226J Response Composer

Linear three-step evidence pipeline for responding to an IRS Letter 226J proposed Employer Shared Responsibility Payment assessment: affordability safe-harbor calculation, ESRP exposure recomputation, and a hash-anchored response evidence pack with a named-HR/benefits-officer attestation closure.

- Page: https://ainumbers.co/chaingraph/chains/aca-226j-response-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/aca-226j-response-composer.md

## Workflow chain: ACA 226J Response Composer

Linear three-step evidence pipeline for responding to an IRS Letter 226J proposed Employer Shared Responsibility Payment assessment: affordability safe-harbor calculation, ESRP exposure recomputation, and a hash-anchored response evidence pack with a named-HR/benefits-officer attestation closure.

Domain: HR & Benefits Compliance

### Steps

1. art-298-aca-affordability-safe-harbor
   affordability harbor verdicts feed Stage 2 ESRP exposure recomputation
2. art-299-aca-esrp-exposure
   controlling_exposure_annual feeds the terminal 226J response evidence pack
3. art-300-aca-226j-response-evidence-pack
   Composes the response-window-deadline evidence pack with named-human attestation closure - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our 226J response disputes some employees the IRS counted. If we withdraw the disputes, how many disputed employees remain in the pack?
Run the AINumbers MCP tool `run_chain` with {"chain":"aca-226j-response-composer"} and read `art-300-aca-226j-response-evidence-pack.disputed_employee_count`.
Re-run with `inputs` for `art-300-aca-226j-response-evidence-pack`, reusing the values that result echoed, with `disputed_employee_ids` changed so the dispute list is emptied. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/aca-226j-response-composer.html

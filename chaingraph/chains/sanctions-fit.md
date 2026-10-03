# Sanctions & Export-Control Screening Fit Diagnostic

Single-node D0 diagnostic scoping a firm's screening/export-control program and routing to the right sanctions/export-control chain. Config-only, no customer data.

- Page: https://ainumbers.co/chaingraph/chains/sanctions-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-fit.md

## Workflow chain: Sanctions & Export-Control Screening Fit Diagnostic

Single-node D0 diagnostic scoping a firm's screening/export-control program and routing to the right sanctions/export-control chain. Config-only, no customer data.

Domain: Sanctions

### Steps

1. art-90-sanctions-screening-fit-diagnostic
   program grade routes to sanctions-ownership / sanctions-list-coverage / sanctions-fuzzy-calibration / ec-eccn-classify / ec-circumvention / sanctions-screening-quality / sanctions-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An examiner asks how our screening program scores today. Which single control lifts the ownership dimension from zero?
Run the AINumbers MCP tool `run_chain` with {"chain":"sanctions-fit"} and read `art-90-sanctions-screening-fit-diagnostic.dim_scores.ownership_50pct`.
Re-run with `inputs` for `art-90-sanctions-screening-fit-diagnostic`, reusing the values that result echoed, with `ownership_screening` set to "50pct-aware". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sanctions-fit.html

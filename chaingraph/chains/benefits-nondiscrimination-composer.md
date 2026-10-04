# Benefits Nondiscrimination Composer

Bundled two-test evidence package: §125 cafeteria-plan nondiscrimination tests and 401(k) ADP/ACP nondiscrimination tests. Each test is independent (no data dependency); bundled here into one plan-year benefits-compliance evidence view.

- Page: https://ainumbers.co/chaingraph/chains/benefits-nondiscrimination-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/benefits-nondiscrimination-composer.md

## Workflow chain: Benefits Nondiscrimination Composer

Bundled two-test evidence package: §125 cafeteria-plan nondiscrimination tests and 401(k) ADP/ACP nondiscrimination tests. Each test is independent (no data dependency); bundled here into one plan-year benefits-compliance evidence view.

Domain: HR & Benefits Compliance

### Steps

1. art-301-section125-ndt
   Independent test - no data dependency. Bundled into the plan-year benefits-compliance evidence package.
2. art-302-401k-adp-acp-test
   Independent test - no data dependency. Bundled into the plan-year benefits-compliance evidence package.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Open enrollment just closed. Do HCE deferral rates clear the ADP and ACP limits this year, or do we owe corrections?
Run the AINumbers MCP tool `run_chain` with {"chain":"benefits-nondiscrimination-composer"} and read `art-302-401k-adp-acp-test.all_tests_pass`.
Re-run with `inputs` for `art-302-401k-adp-acp-test`, reusing the values that result echoed, with `adp_hce_pct` set to 0.08. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/benefits-nondiscrimination-composer.html

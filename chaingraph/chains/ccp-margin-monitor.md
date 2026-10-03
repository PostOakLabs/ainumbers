# CCP Margin Monitor

Quarterly public benchmark chain for the CCP Margin Monitor series: presents the cross-CCP public quantitative disclosure (PQD) field comparison - financial resources, default fund size, Cover-2 stress loss, initial margin required, skin-in-the-game - across FICC and ICE for the benchmark's published issues. Presentation and receipt wiring over the already-proven comparator node - no new derive step.

- Page: https://ainumbers.co/chaingraph/chains/ccp-margin-monitor.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ccp-margin-monitor.md

## Workflow chain: CCP Margin Monitor

Quarterly public benchmark chain for the CCP Margin Monitor series: presents the cross-CCP public quantitative disclosure (PQD) field comparison - financial resources, default fund size, Cover-2 stress loss, initial margin required, skin-in-the-game - across FICC and ICE for the benchmark's published issues. Presentation and receipt wiring over the already-proven comparator node - no new derive step.

Domain: Treasury Clearing

### Steps

1. art-528-cross-ccp-pqd-comparator
   comparison arithmetic and delta table are the terminal output; the Monitor's presentation layer selects and labels fields for quarterly publication, no downstream derive stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A member asks whether its GSD and ICEU books face two separate clearing houses. What does the comparator report?
Run the AINumbers MCP tool `run_chain` with {"chain":"ccp-margin-monitor"} and read `art-528-cross-ccp-pqd-comparator.cross_ccp`.
Re-run with `inputs` for `art-528-cross-ccp-pqd-comparator`, reusing the values that result echoed, with `entity_b` changed so entity_b is the ICE ICEU division. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ccp-margin-monitor.html

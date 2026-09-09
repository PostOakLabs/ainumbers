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

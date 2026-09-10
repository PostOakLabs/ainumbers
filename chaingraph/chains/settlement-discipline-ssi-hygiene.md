# SSI Hygiene & Match-Rate

SSI completeness/staleness/format conformance + golden-source match-rate scoring (ART-80) -> audit receipt (cry-05). The single highest-leverage T+1 prep: clean SSIs prevent ~30% of fails.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-ssi-hygiene.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-ssi-hygiene.md

## Workflow chain: SSI Hygiene & Match-Rate

SSI completeness/staleness/format conformance + golden-source match-rate scoring (ART-80) -> audit receipt (cry-05). The single highest-leverage T+1 prep: clean SSIs prevent ~30% of fails.

Domain: Settlement Discipline

### Steps

1. art-80-ssi-conformance-checker
   flagged records + match-rate (H1) feed the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite SSI-hygiene artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

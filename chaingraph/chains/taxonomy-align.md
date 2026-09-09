# EU Taxonomy Activity Alignment

Activity-level Taxonomy alignment: substantial-contribution + DNSH + minimum-safeguards scoring (ART-73) -> audit receipt (cry-05). The activity-by-activity alignment decision an undertaking emits and an auditor re-verifies.

- Page: https://ainumbers.co/chaingraph/chains/taxonomy-align.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/taxonomy-align.md

## Workflow chain: EU Taxonomy Activity Alignment

Activity-level Taxonomy alignment: substantial-contribution + DNSH + minimum-safeguards scoring (ART-73) -> audit receipt (cry-05). The activity-by-activity alignment decision an undertaking emits and an auditor re-verifies.

Domain: Climate & Sustainable Finance

### Steps

1. art-73-taxonomy-alignment-scorer
   alignment verdict + gaps (H1) feed the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Exports composite alignment artifact with execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

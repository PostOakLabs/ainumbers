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

### Ask your agent

Question: The sustainability team calls this activity taxonomy aligned. Do its criteria evidence and safeguards hold up?
Run the AINumbers MCP tool `run_chain` with {"chain":"taxonomy-align"} and read `art-73-taxonomy-alignment-scorer.alignment_verdict`.
Re-run with `inputs` for `art-73-taxonomy-alignment-scorer`, reusing the values that result echoed, with `substantial_contribution` changed so substantial_contribution set to met, with minimum_safeguards in-place. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/taxonomy-align.html

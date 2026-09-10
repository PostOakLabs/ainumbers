# Taxonomy KPI & Green Asset Ratio

Activity alignment (ART-73) -> entity revenue/CapEx/OpEx KPIs + Green Asset Ratio for financials (ART-74) -> audit receipt (cry-05). Rolls activity-level alignment into the entity disclosure KPIs an issuer/bank reports to investors and supervisors.

- Page: https://ainumbers.co/chaingraph/chains/taxonomy-kpi.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/taxonomy-kpi.md

## Workflow chain: Taxonomy KPI & Green Asset Ratio

Activity alignment (ART-73) -> entity revenue/CapEx/OpEx KPIs + Green Asset Ratio for financials (ART-74) -> audit receipt (cry-05). Rolls activity-level alignment into the entity disclosure KPIs an issuer/bank reports to investors and supervisors.

Domain: Climate & Sustainable Finance

### Steps

1. art-73-taxonomy-alignment-scorer
   per-activity alignment (H1) feeds the KPI aggregator
2. art-74-taxonomy-kpi-gar-aggregator
   KPI set + GAR (H2) feed the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite KPI/GAR artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

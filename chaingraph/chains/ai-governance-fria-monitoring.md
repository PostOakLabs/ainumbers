# Deployer FRIA & Post-Market Monitoring

W-B. Article 27 FRIA + Article 72 post-market monitoring + logging/oversight (ART-66) -> SR 11-7 model-risk evidence (451) -> audit receipt (cry-05). The flagship deployer lifecycle for a bank/insurer using a high-risk AI system. Decision-support draft.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-fria-monitoring.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-fria-monitoring.md

## Workflow chain: Deployer FRIA & Post-Market Monitoring

W-B. Article 27 FRIA + Article 72 post-market monitoring + logging/oversight (ART-66) -> SR 11-7 model-risk evidence (451) -> audit receipt (cry-05). The flagship deployer lifecycle for a bank/insurer using a high-risk AI system. Decision-support draft.

Domain: AI Governance

### Steps

1. art-66-fria-postmarket-monitoring-builder
   fria_grade and monitoring_plan (H1) feed the model-risk assessor
2. 451-sr11-7-model-risk-management-gap-assessor
   model-risk gaps (H2) feed the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite FRIA/monitoring artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Model Risk & AI-Fairness Governance

EU AI Act risk classification > SR 11-7 MRM gap assessment > fair-lending bias testing > AI Act Art.9 risk-management system > AI-governance mandate.

- Page: https://ainumbers.co/chaingraph/chains/model-risk-governance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/model-risk-governance.md

## Workflow chain: Model Risk & AI-Fairness Governance

EU AI Act risk classification > SR 11-7 MRM gap assessment > fair-lending bias testing > AI Act Art.9 risk-management system > AI-governance mandate.

Domain: AI & Agent Governance

### Steps

1. 327-eu-ai-act-risk-class-mapper
   risk_tier and obligations feed Stage 2 MRM gap assessment
2. 451-sr11-7-model-risk-management-gap-assessor
   mrm_gaps and severity feed Stage 3 fair-lending testing
3. 452-fair-lending-ai-bias-assessment
   disparate_impact_metrics feed Stage 4 Art.9 RMS build
4. 333-eu-ai-act-article9-risk-mgmt-builder
   Exports AI-governance Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

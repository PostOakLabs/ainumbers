# EU AI Act Provider & Deployer Obligations

EU AI Act risk class mapping > Article 9 risk management system > Article 10 data governance > provider/deployer obligations split: composite EU AI Act provider compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/eu-ai-act-provider-obligations.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eu-ai-act-provider-obligations.md

## Workflow chain: EU AI Act Provider & Deployer Obligations

EU AI Act risk class mapping > Article 9 risk management system > Article 10 data governance > provider/deployer obligations split: composite EU AI Act provider compliance mandate.

Domain: AI & Agent Governance

### Steps

1. 327-eu-ai-act-risk-class-mapper
   risk_classification and high_risk_determination feed Stage 2 Article 9 risk mgmt system
2. 333-eu-ai-act-article9-risk-mgmt-builder
   risk_mgmt_system_gaps and corrective_actions feed Stage 3 Article 10 data governance
3. 334-eu-ai-act-article10-data-governance-mapper
   data_governance_requirements and bias_monitoring feed Stage 4 provider/deployer split
4. 335-eu-ai-act-provider-deployer-obligations-splitter
   obligation_split and composite_ai_act_mandate - final EU AI Act provider mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Fraud & Scam Decisioning

Velocity rule building > structuring pattern detection > fraud investigation > APP-scam risk scoring > fraud/velocity policy mandate.

- Page: https://ainumbers.co/chaingraph/chains/fraud-decisioning.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/fraud-decisioning.md

## Workflow chain: Fraud & Scam Decisioning

Velocity rule building > structuring pattern detection > fraud investigation > APP-scam risk scoring > fraud/velocity policy mandate.

Domain: Fraud & Dispute

### Steps

1. 256-rtp-fraud-velocity-rule-builder
   rule_set and velocity_thresholds feed Stage 2 structuring pattern detection
2. 117-structuring-pattern-detector
   detected_patterns and risk_flags feed Stage 3 fraud investigation
3. 80-fraud-investigation-lab
   investigation_findings and disposition feed Stage 4 APP-scam scoring
4. 322-app-scam-risk-assessor
   Exports fraud/velocity Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

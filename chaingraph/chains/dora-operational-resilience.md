# DORA Operational Resilience Reporting

GDPR DSR workflow generation > BCBS239 model-risk readiness scoring > MiFID2 transaction-reporting compliance > operational resilience self-assessment > FCA consumer duty outcome dashboard: composite operational resilience reporting mandate.

- Page: https://ainumbers.co/chaingraph/chains/dora-operational-resilience.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dora-operational-resilience.md

## Workflow chain: DORA Operational Resilience Reporting

GDPR DSR workflow generation > BCBS239 model-risk readiness scoring > MiFID2 transaction-reporting compliance > operational resilience self-assessment > FCA consumer duty outcome dashboard: composite operational resilience reporting mandate.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. 311-gdpr-dsr-workflow-generator
   dsr_workflow and data_subject_obligations feed Stage 2 BCBS239 model-risk scoring
2. 312-bcbs239-model-risk-readiness-scorer
   model_risk_score and bcbs239_gaps feed Stage 3 MiFID2 transaction-reporting check
3. 313-mifid2-transaction-reporting-checker
   transaction_reporting_gaps and remediation feed Stage 4 operational resilience assessment
4. 314-operational-resilience-self-assessment
   resilience_self_assessment and scenario_gaps feed Stage 5 consumer duty dashboard
5. 315-fca-consumer-duty-outcome-dashboard
   consumer_duty_outcomes and composite_resilience_mandate - final operational resilience mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

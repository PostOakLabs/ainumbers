# EU AI Act for Financial Services Chain

Classify agentic AI and GPAI risk tier and map EU AI Act Article 6 risk class → run high-risk fit and classification diagnostic → build conformity pack, Article 9 risk management system, and credit-scoring conformity pack → build FRIA and post-market monitoring plan and assess SR 11-7 model risk management gaps → aggregate agent-action audit trail for EU AI Act Article 12 / DORA. End-to-end EU AI Act Article 5-66 compliance journey for financial services.

- Page: https://ainumbers.co/chaingraph/chains/ai-act-for-fs.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-act-for-fs.md

## Workflow chain: EU AI Act for Financial Services Chain

Classify agentic AI and GPAI risk tier and map EU AI Act Article 6 risk class → run high-risk fit and classification diagnostic → build conformity pack, Article 9 risk management system, and credit-scoring conformity pack → build FRIA and post-market monitoring plan and assess SR 11-7 model risk management gaps → aggregate agent-action audit trail for EU AI Act Article 12 / DORA. End-to-end EU AI Act Article 5-66 compliance journey for financial services.

Domain: AI & Agent Governance

### Steps

1. art-67-agentic-ai-risk-classifier
   risk_tier,gpai_obligations,prohibited_flag,transparency_duties feed Stage 2 high-risk fit
2. 327-eu-ai-act-risk-class-mapper
   risk_class,annex_iii_applicable,high_risk_criteria,registration_threshold feed Stage 2 high-risk fit
3. art-64-ai-act-highrisk-fit-diagnostic
   high_risk_confirmed,gap_list,registration_required,obligations_triggered feed Stage 3 conformity
4. art-65-ai-conformity-pack-builder
   conformity_pack_json,qms_requirements,technical_doc_checklist feed Stage 3 risk mgmt
5. 333-eu-ai-act-article9-risk-mgmt-builder
   risk_mgmt_plan,residual_risk_score,monitoring_frequency feed Stage 3 credit conformity
6. art-05-eu-ai-act-credit-scoring-conformity
   credit_scoring_conformity_pass,bias_mitigation_required,model_card_needed feed Stage 4 FRIA
7. art-66-fria-postmarket-monitoring-builder
   fria_required,monitoring_cadence,incident_criteria,sentinel_events feed Stage 4 MRM gap
8. 451-sr11-7-model-risk-management-gap-assessor
   mrm_gap_score,validation_independence_flag,remediation_priority feed Stage 5 audit trail
9. cry-05-agent-action-audit-trail-aggregator
   session_receipt_root,audit_hash - Exports EU AI Act financial services compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

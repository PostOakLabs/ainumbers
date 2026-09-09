# EU AI Act High-Risk Fit & Classification Diagnostic

12-question A-F diagnostic that screens in-force obligations first (Art 5 prohibited practices, Art 4 AI literacy, GPAI) then classifies financial AI system high-risk status (Annex III: credit scoring, insurance pricing, financial-standing) and grades Article 9-15 readiness plus the provider/deployer split. Routes to the right ai-governance chain with a do-now vs prepare-ahead checklist and applicable date (2 Dec 2027 per Digital Omnibus, verify).

- Page: https://ainumbers.co/chaingraph/art-64-ai-act-highrisk-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-64-ai-act-highrisk-fit-diagnostic.md
- MCP tool: run_ai_act_highrisk_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- actor_role (unknown, optional)
- ai_literacy_programme (unknown, optional)
- annex_iii_match (unknown, optional)
- data_governance (unknown, optional)
- eu_nexus (unknown, optional)
- foundation_model_dependency (unknown, optional)
- fria_status (unknown, optional)
- logging_oversight (unknown, optional)
- model_risk_framework (unknown, optional)
- post_market_monitoring (unknown, optional)
- prohibited_practice_exposure (unknown, optional)
- risk_mgmt_system (unknown, optional)
- system_name (unknown, optional)
- technical_documentation (unknown, optional)
- use_case (unknown, optional)

## Outputs

- ai_literacy_grade (string, optional)
- annex_iii_basis (string, optional)
- applicable_date (object, optional)
- dim_scores (object, optional)
- do_now_checklist (array, optional)
- gpai_applicability (string, optional)
- high_risk_verdict (string, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (number, optional)
- prepare_ahead_checklist (array, optional)
- primary_recommendation (string, optional)
- prohibited_practice_verdict (string, optional)
- role (string, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_ai_act_highrisk_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

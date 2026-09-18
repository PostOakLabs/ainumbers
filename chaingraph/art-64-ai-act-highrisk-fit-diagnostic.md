# EU AI Act High-Risk Fit & Classification Diagnostic

12-question A-F diagnostic that screens in-force obligations first (Art 5 prohibited practices, Art 4 AI literacy, GPAI) then classifies financial AI system high-risk status (Annex III: credit scoring, insurance pricing, financial-standing) and grades Article 9-15 readiness plus the provider/deployer split. Routes to the right ai-governance chain with a do-now vs prepare-ahead checklist and applicable date (2 Dec 2027 per Digital Omnibus, verify).

- Page: https://ainumbers.co/chaingraph/art-64-ai-act-highrisk-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-64-ai-act-highrisk-fit-diagnostic.md
- MCP tool: run_ai_act_highrisk_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- actor_role (any, optional): type not evidenced by kernel source
- ai_literacy_programme (any, optional): type not evidenced by kernel source
- annex_iii_match (any, optional): type not evidenced by kernel source
- data_governance (any, optional): type not evidenced by kernel source
- eu_nexus (any, optional): type not evidenced by kernel source
- foundation_model_dependency (any, optional): type not evidenced by kernel source
- fria_status (any, optional): type not evidenced by kernel source
- logging_oversight (any, optional): type not evidenced by kernel source
- model_risk_framework (any, optional): type not evidenced by kernel source
- post_market_monitoring (any, optional): type not evidenced by kernel source
- prohibited_practice_exposure (any, optional): type not evidenced by kernel source
- risk_mgmt_system (any, optional): type not evidenced by kernel source
- system_name (any, optional): type not evidenced by kernel source
- technical_documentation (any, optional): type not evidenced by kernel source
- use_case (any, optional): type not evidenced by kernel source

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

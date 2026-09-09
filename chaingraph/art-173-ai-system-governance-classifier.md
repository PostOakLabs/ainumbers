# AI System Governance Classifier

Classify an AI system to its governance tier across EU AI Act (prohibited/high-risk/limited-risk/minimal-risk), NIST AI RMF profile (T1 basic/T2 standard/T3 enhanced), and ISO/IEC 42001 control set (light/standard/enhanced). Identifies GPAI provider status and systemic-risk flag. Terminal node of the ai-management-system-conformance chain. EU AI Act Art. 6-17 enforcement from 2 December 2027, per the Digital Omnibus amendments (June 2026); Art. 50 transparency stays 2 August 2026. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-173-ai-system-governance-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-173-ai-system-governance-classifier.md
- MCP tool: classify_ai_system_governance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- system (unknown, optional)

## Outputs

- deployment_context (string, optional)
- eu_ai_act_tier (string, optional)
- gpai_obligations (object, optional)
- iso42001_control_set (string, optional)
- nist_rmf_profile (string, optional)
- use_case (string, optional)

## Sample

```json
{
  "system": {
    "use_case": "Automated credit scoring for consumer loans",
    "deployment_context": "credit",
    "is_gpai": true,
    "has_systemic_risk": true,
    "is_autonomous": false,
    "processes_biometrics": false,
    "affects_critical_infrastructure": false,
    "is_emotion_recognition": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_ai_system_governance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

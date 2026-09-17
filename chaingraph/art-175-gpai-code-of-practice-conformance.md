# GPAI Code of Practice Conformance

Check GPAI provider obligations under EU AI Act Art. 53 (technical documentation, training-data summary, copyright policy, model card, 4 base checks) and Art. 55 systemic-risk obligations (risk evaluation, adversarial testing, incident reporting, cybersecurity measures, 4 additional checks for systemic-risk models). Also scores voluntary Code of Practice sign-up. Returns base_score, systemic_score, overall_score, conformant flags, and gap lists. Feeds readiness diagnostic (art-176). GPAI enforcement Aug 2026. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-175-gpai-code-of-practice-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-175-gpai-code-of-practice-conformance.md
- MCP tool: check_gpai_code_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- provider (unknown, optional)

## Outputs

- base_conformant (boolean, optional)
- base_gaps (array, optional)
- base_score (integer, optional)
- code_of_practice_signed (boolean, optional)
- is_gpai_provider (boolean, optional)
- is_systemic_risk (boolean, optional)
- overall_score (integer, optional)
- systemic_gaps (array, optional)
- systemic_risk_conformant (boolean, optional)
- systemic_score (integer, optional)

## Sample

```json
{
  "provider": {
    "is_gpai_provider": true,
    "technical_documentation": true,
    "training_data_summary": true,
    "copyright_policy": true,
    "model_card_published": true,
    "is_systemic_risk": true,
    "systemic_risk_eval_conducted": true,
    "adversarial_testing_done": true,
    "incident_reporting_active": true,
    "cybersecurity_measures": true,
    "code_of_practice_signed": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_gpai_code_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

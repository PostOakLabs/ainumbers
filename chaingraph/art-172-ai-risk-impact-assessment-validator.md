# AI Risk Impact Assessment Validator

Validate ISO 42005-style AI impact-assessment completeness across seven required elements: intended use, affected stakeholders (>=1), risk treatment definition, monitoring plan, formal approval, risk category identification (>=1), and data source documentation. Returns completeness_score (0-100) and gaps list. Feeds system governance classifier (art-173). Zero network, zero PII. ISO/IEC 42005.

- Page: https://ainumbers.co/chaingraph/art-172-ai-risk-impact-assessment-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-172-ai-risk-impact-assessment-validator.md
- MCP tool: validate_ai_impact_assessment (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assessment (unknown, optional)

## Outputs

- complete (boolean, optional)
- completeness_score (integer, optional)
- fields_checked (integer, optional)
- fields_passed (integer, optional)
- gaps (array, optional)

## Sample

```json
{
  "assessment": {
    "intended_use": "Customer credit scoring system for retail banking",
    "affected_stakeholders": [
      "retail_customers",
      "credit_officers",
      "compliance_team"
    ],
    "risk_treatment_defined": true,
    "monitoring_plan": "Monthly bias audits and quarterly accuracy reviews with documented escalation procedure",
    "approval_documented": true,
    "risk_categories": [
      "bias",
      "accuracy",
      "privacy",
      "security"
    ],
    "data_sources_listed": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_ai_impact_assessment` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

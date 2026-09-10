# ISO 42001 AIMS Clause Conformance

Assess ISO/IEC 42001 AIMS conformance across clauses 4-10 (context, leadership, planning, support, operation, evaluation, improvement) and six Annex A controls (AI policy, roles, impact assessment, data governance, system lifecycle, third-party supplier management). Scores each as present (1.0), partial (0.5), or absent (0) and returns overall_maturity (0-100), maturity_band (Initial/Developing/Defined/Managed/Optimizing), and a structured gap list. Root node of the ai-management-system-conformance chain. §16 proof candidate. Zero network, zero PII. ISO/IEC 42001:2023.

- Page: https://ainumbers.co/chaingraph/art-171-iso42001-aims-clause-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-171-iso42001-aims-clause-conformance.md
- MCP tool: assess_iso42001_aims_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aims (unknown, required)

## Outputs

- clause_score (integer, optional)
- clauses_fully_present (integer, optional)
- control_score (integer, optional)
- controls_fully_present (integer, optional)
- gaps (array, optional)
- maturity_band (string, optional)
- overall_maturity (integer, optional)
- total_clauses (integer, optional)
- total_controls (integer, optional)

## Sample

```json
{
  "aims": {
    "clause_4_context": true,
    "clause_5_leadership": true,
    "clause_6_planning": true,
    "clause_7_support": true,
    "clause_8_operation": true,
    "clause_9_evaluation": true,
    "clause_10_improvement": true,
    "annex_a_ai_policy": true,
    "annex_a_roles": true,
    "annex_a_impact_assessment": true,
    "annex_a_data_governance": true,
    "annex_a_system_lifecycle": true,
    "annex_a_third_party": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_iso42001_aims_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

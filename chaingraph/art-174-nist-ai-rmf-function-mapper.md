# NIST AI RMF Function Mapper

Map supplied AI controls and evidence to NIST AI RMF Govern (5 controls), Map (4), Measure (4), and Manage (4) functions: 17 controls total. Returns per-function coverage scores (0-100), coverage_band (Minimal/Partial/Substantial/Comprehensive), overall_coverage, and structured gap lists by function. Root node of the ai-governance-framework-crosswalk chain. NIST AI RMF 1.0 (2023). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-174-nist-ai-rmf-function-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-174-nist-ai-rmf-function-mapper.md
- MCP tool: map_nist_ai_rmf_functions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- evidence (unknown, optional)

## Outputs

- all_gaps (array, optional)
- controls_present (integer, optional)
- coverage_band (string, optional)
- function_coverage (object, optional)
- overall_coverage (integer, optional)
- total_controls (integer, optional)

## Sample

```json
{
  "evidence": {
    "govern_policy": true,
    "govern_roles": true,
    "govern_culture": true,
    "govern_transparency": true,
    "govern_accountability": true,
    "map_context": true,
    "map_categorization": true,
    "map_risk_identification": true,
    "map_stakeholders": true,
    "measure_analysis": true,
    "measure_monitoring": true,
    "measure_testing": true,
    "measure_benchmarking": true,
    "manage_response": true,
    "manage_prioritization": true,
    "manage_treatment": true,
    "manage_residual_risk": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_nist_ai_rmf_functions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

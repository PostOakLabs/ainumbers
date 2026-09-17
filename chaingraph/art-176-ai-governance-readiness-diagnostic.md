# AI Governance Readiness Diagnostic

A-F AI governance readiness diagnostic across six dimensions spanning ISO/IEC 42001, NIST AI RMF, and EU AI Act convergence: AIMS documentation, impact assessment, NIST RMF mapping, GPAI obligation check, monitoring plan, and review cycle. Returns readiness_grade (A-F), readiness_score (0-100), gaps list, and frameworks_addressed map (ISO 42001, NIST RMF, EU AI Act). Terminal node of the ai-governance-framework-crosswalk chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-176-ai-governance-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-176-ai-governance-readiness-diagnostic.md
- MCP tool: run_ai_governance_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity (unknown, optional)

## Outputs

- dimensions_met (integer, optional)
- dimensions_total (integer, optional)
- frameworks_addressed (object, optional)
- fully_ready (boolean, optional)
- gaps (array, optional)
- readiness_grade (string, optional)
- readiness_score (integer, optional)

## Sample

```json
{
  "entity": {
    "aims_documented": true,
    "impact_assessed": true,
    "nist_rmf_mapped": true,
    "gpai_obligations_checked": true,
    "monitoring_plan_active": true,
    "review_cycle_defined": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_ai_governance_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

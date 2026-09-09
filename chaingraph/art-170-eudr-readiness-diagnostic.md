# EUDR Readiness Diagnostic

A-F EUDR readiness diagnostic across six dimensions: scope mapping, geolocation data quality, DDS submission readiness (TRACES NT), country risk assessment, risk mitigation documentation, and 5-year retention system. Returns readiness_grade (A-F), readiness_score (0-100), gaps list, and dual enforcement deadlines (large/medium 2026-12-30; micro/SME 2027-06-30). Terminal node of the eudr-supply-chain-risk-and-traceability chain. Zero network, zero PII. Reg. EU 2023/1115.

- Page: https://ainumbers.co/chaingraph/art-170-eudr-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-170-eudr-readiness-diagnostic.md
- MCP tool: run_eudr_readiness_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity (unknown, optional)

## Outputs

- dimensions_met (integer, optional)
- dimensions_total (integer, optional)
- enforcement_deadlines (array, optional)
- fully_ready (boolean, optional)
- gaps (array, optional)
- readiness_grade (string, optional)
- readiness_score (integer, optional)

## Sample

```json
{
  "entity": {
    "scope_mapped": true,
    "geolocation_data_ready": true,
    "dds_submission_ready": true,
    "risk_assessed": true,
    "mitigation_documented": true,
    "retention_system_ready": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_eudr_readiness_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Sanctions & Export-Control Screening Fit Diagnostic

12-param A-F diagnostic scoping a firm's sanctions/export-control screening program (50%-rule ownership, list coverage, fuzzy-match calibration, ECCN classification, circumvention controls) and routing to the right sanctions/export-control chain. Operates on program config only - no real customer data.

- Page: https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.md
- MCP tool: run_sanctions_screening_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- adverse_media (unknown, optional)
- alert_review_sla (unknown, optional)
- business_model (unknown, optional)
- circumvention_controls (unknown, optional)
- export_control_exposure (unknown, optional)
- fuzzy_match_governance (unknown, optional)
- jurisdictional_nexus (unknown, optional)
- ownership_screening (unknown, optional)
- pep_screening (unknown, optional)
- sanctions_lists_screened (unknown, optional)
- screening_frequency (unknown, optional)
- sectoral_screening (unknown, optional)

## Outputs

- always_route (array, optional)
- dim_scores (object, optional)
- gaps (array, optional)
- key_dates (object, optional)
- note (string, optional)
- primary_recommendation (string, optional)
- program_grade (string, optional)
- raw_score (integer, optional)
- reference_version (string, optional)
- secondary_routes (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_sanctions_screening_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

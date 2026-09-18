# Sanctions & Export-Control Screening Fit Diagnostic

12-param A-F diagnostic scoping a firm's sanctions/export-control screening program (50%-rule ownership, list coverage, fuzzy-match calibration, ECCN classification, circumvention controls) and routing to the right sanctions/export-control chain. Operates on program config only - no real customer data.

- Page: https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-90-sanctions-screening-fit-diagnostic.md
- MCP tool: run_sanctions_screening_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- adverse_media (any, optional): type not evidenced by kernel source
- alert_review_sla (any, optional): type not evidenced by kernel source
- business_model (any, optional): type not evidenced by kernel source
- circumvention_controls (any, optional): type not evidenced by kernel source
- export_control_exposure (any, optional): type not evidenced by kernel source
- fuzzy_match_governance (any, optional): type not evidenced by kernel source
- jurisdictional_nexus (any, optional): type not evidenced by kernel source
- ownership_screening (any, optional): type not evidenced by kernel source
- pep_screening (any, optional): type not evidenced by kernel source
- sanctions_lists_screened (any, optional): type not evidenced by kernel source
- screening_frequency (any, optional): type not evidenced by kernel source
- sectoral_screening (any, optional): type not evidenced by kernel source

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

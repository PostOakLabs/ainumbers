# MiCA CASP Fit Diagnostic

12-question A-F diagnostic scoping a crypto-asset service provider's MiCA Title-V lifecycle readiness (authorization, Art 67 own-funds, whitepaper, MAR-crypto, travel rule) and routing to the right MiCA chain. Config-only; ART/EMT-issuer cases route to existing stablecoin chains.

- Page: https://ainumbers.co/chaingraph/art-98-mica-casp-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-98-mica-casp-fit-diagnostic.md
- MCP tool: run_mica_casp_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- current_status (unknown, optional)
- custody_segregation (unknown, optional)
- governance_maturity (unknown, optional)
- inputs (unknown, required)
- mar_arrangements (unknown, optional)
- member_state (unknown, optional)
- own_funds_status (unknown, optional)
- services (unknown, optional)
- travel_rule_status (unknown, optional)
- whitepaper_required (unknown, optional)

## Outputs

- dim_scores (object, optional)
- gaps (array, optional)
- note (string, optional)
- primary_recommendation (string, optional)
- readiness_grade (string, optional)
- reference_version (string, optional)
- secondary_recommendations (array, optional)
- services_count (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_mica_casp_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

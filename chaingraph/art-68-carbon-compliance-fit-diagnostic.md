# Carbon & Climate Compliance Fit Diagnostic

12-question A-F diagnostic that classifies which carbon/climate obligations bind a firm (CBAM authorised-declarant duty, EU Taxonomy alignment, EU Green Bond conformance, climate stress) and routes to the right carbon-compliance chain. Separates in-force CBAM definitive liability (since 1 Jan 2026) from prepare-ahead items (first declaration 30 Sep 2027, downstream scope 1 Jan 2028).

- Page: https://ainumbers.co/chaingraph/art-68-carbon-compliance-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-68-carbon-compliance-fit-diagnostic.md
- MCP tool: run_carbon_compliance_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cbam_good_categories (any, optional): type not evidenced by kernel source
- climate_stress_applicable (any, optional): type not evidenced by kernel source
- declarant_status (any, optional): type not evidenced by kernel source
- emissions_data_basis (any, optional): type not evidenced by kernel source
- entity_name (any, optional): type not evidenced by kernel source
- eu_nexus (any, optional): type not evidenced by kernel source
- eugb_intent (any, optional): type not evidenced by kernel source
- imports_cbam_goods (any, optional): type not evidenced by kernel source
- origin_carbon_price (any, optional): type not evidenced by kernel source
- reporting_year (any, optional): type not evidenced by kernel source
- taxonomy_objectives_assessed (any, optional): type not evidenced by kernel source
- taxonomy_scope (any, optional): type not evidenced by kernel source

## Outputs

- cbam_declarant_required (boolean, optional)
- cbam_declarant_verdict (string, optional)
- cbam_dual_status (object, optional)
- climate_stress_applicable (string, optional)
- dim_scores (object, optional)
- do_now_checklist (array, optional)
- eugb_readiness (string, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (number, optional)
- prepare_ahead_checklist (array, optional)
- primary_recommendation (string, optional)
- secondary_recommendations (array, optional)
- taxonomy_scope (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_carbon_compliance_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

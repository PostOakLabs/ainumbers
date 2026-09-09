# CBAM Embedded-Emissions Calculator

Flagship importer tool. Computes embedded emissions (direct + indirect, tCO2e) for a consignment of CBAM goods from actual installation data or Commission default values, applying the system boundaries and monitoring rules of the Implementing Regulation. Handles precursor emissions from ART-72.

- Page: https://ainumbers.co/chaingraph/art-69-cbam-embedded-emissions-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-69-cbam-embedded-emissions-calculator.md
- MCP tool: calculate_cbam_embedded_emissions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cn_code (unknown, optional)
- country_of_origin (unknown, optional)
- direct_emissions_factor (unknown, optional)
- electricity_source (unknown, optional)
- emissions_basis (unknown, optional)
- good_category (unknown, optional)
- indirect_emissions_factor (unknown, optional)
- monitoring_method (unknown, optional)
- precursor_emissions (unknown, optional)
- quantity_tonnes (unknown, optional)

## Outputs

- basis (string, optional)
- cn_code (string, optional)
- country_of_origin (string, optional)
- data_quality_flag (string, optional)
- default_markup_applied (boolean, optional)
- good_category (string, optional)
- monitoring_method (string, optional)
- precursor_contribution (integer, optional)
- quantity_tonnes (integer, optional)
- reference (object, optional)
- see_direct (number, optional)
- see_indirect (number, optional)
- see_total (number, optional)
- total_embedded_emissions_tco2e (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_cbam_embedded_emissions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

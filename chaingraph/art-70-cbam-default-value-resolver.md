# CBAM Default-Value Resolver

Resolves the Commission default embedded-emissions value for a (CN code x country-of-origin) pair, applies the year-dependent markup vs the actual-data path (+10% 2026, +20% 2027, +30% 2028+), and returns the value with provenance citing the CBAM Implementing Regulation.

- Page: https://ainumbers.co/chaingraph/art-70-cbam-default-value-resolver.html
- Markdown twin: https://ainumbers.co/chaingraph/art-70-cbam-default-value-resolver.md
- MCP tool: resolve_cbam_default_value (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- actual_data_available (unknown, optional)
- cn_code (unknown, optional)
- country_of_origin (unknown, optional)
- good_category (unknown, optional)
- reporting_year (unknown, optional)

## Outputs

- actual_path_recommended (boolean, optional)
- cn_code (string, optional)
- country_of_origin (string, optional)
- default_value_tco2e_per_t (number, optional)
- effective_default (number, optional)
- good_category (string, optional)
- markup_pct (integer, optional)
- note (string, optional)
- provenance (string, optional)
- reference_version (string, optional)
- reporting_year (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `resolve_cbam_default_value` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# CBPR+ Structured Address Linter

Lints a single pacs.008 PostalAddress24 block against the SWIFT CBPR+ November 2026 mandate. Detects unstructured AdrLine-only addresses (prohibited), hybrid silent-fail duplication (AdrLine echoing structured field values, which causes STP rejection without a visible error code), and address structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED, EMPTY). Per-message lint - for batch verification of migrated address archives use verify_address_migration_batch (rca-03).

- Page: https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-241-cbpr-structured-address-linter.md
- MCP tool: lint_cbpr_structured_address (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- address_lines (unknown, required)
- building_number (unknown, required)
- country (unknown, required)
- country_subdivision (unknown, required)
- post_code (unknown, required)
- street_name (unknown, required)
- town_name (unknown, required)

## Outputs

- cbpr_plus_deadline (string, optional)
- compliant (boolean, optional)
- disambiguation (string, optional)
- error_count (integer, optional)
- pii_note (string, optional)
- readiness_pct (integer, optional)
- regulatory_basis (string, optional)
- structure_type (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- violations (array, optional)

## Sample

```json
{
  "street_name": "Kaiserstrasse",
  "building_number": "29",
  "post_code": "60311",
  "town_name": "Frankfurt",
  "country": "DE",
  "address_lines": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_cbpr_structured_address` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

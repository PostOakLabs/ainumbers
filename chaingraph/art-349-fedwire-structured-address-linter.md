# Fedwire Structured Address Linter

Lints a Fedwire or CHIPS ISO 20022 PostalAddress24 block against the November 2026 structured-address mandate (network param selects fedwire or chips; rules verified byte-identical between the two networks at build time). On 2026-11-16 Fedwire and CHIPS remove the fully-unstructured postal address option in favor of a single hybrid format - Town Name and Country always required, up to 2 supplemental AdrLine elements of 70 chars each. Detects unstructured AdrLine-only addresses (prohibited), hybrid silent-fail duplication (AdrLine echoing structured field values, which causes STP rejection without a visible error code), and address structure type (FULLY_STRUCTURED, HYBRID, UNSTRUCTURED, EMPTY). For the SWIFT CBPR+ cross-border equivalent use lint_cbpr_structured_address (art-241).

- Page: https://ainumbers.co/chaingraph/art-349-fedwire-structured-address-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-349-fedwire-structured-address-linter.md
- MCP tool: lint_fedwire_structured_address (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- address_lines (unknown, required)
- building_number (unknown, required)
- country (unknown, required)
- country_subdivision (unknown, required)
- network (unknown, required)
- post_code (unknown, required)
- street_name (unknown, required)
- town_name (unknown, required)

## Outputs

- compliant (boolean, optional)
- disambiguation (string, optional)
- error_count (integer, optional)
- fedwire_chips_deadline (string, optional)
- network (string, optional)
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
  "network": "fedwire",
  "street_name": "400 South Hope Street",
  "building_number": "",
  "post_code": "90071",
  "town_name": "Los Angeles",
  "country": "US",
  "country_subdivision": "CA",
  "address_lines": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_fedwire_structured_address` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

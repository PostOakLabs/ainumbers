# NAIC Producer License Reciprocity Check

Checks NAIC producer license reciprocity for non-resident filing across target states per MDL-218 and NIPR Reciprocity Matrix 2024. Returns all_reciprocal (bool), non_standard_states[] (CA, FL, NJ, NY, HI, MN, WI - require independent filing), and coverage_by_target[] with per-state reciprocal flag, LOA gaps, and independent-filing notes. State codes and NAIC LOA enum codes only. No National Producer Numbers. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/art-267-check-producer-license-reciprocity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-267-check-producer-license-reciprocity.md
- MCP tool: check_producer_license_reciprocity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- loa_codes (unknown, optional)
- resident_state (unknown, optional)
- target_states (unknown, optional)

## Outputs

- all_reciprocal (boolean, optional)
- coverage_by_target (array, optional)
- invalid_loa_codes (array, optional)
- loa_codes (array, optional)
- non_standard_states (array, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- resident_state (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- target_state_count (integer, optional)

## Sample

```json
{
  "resident_state": "OR",
  "loa_codes": [
    "L",
    "H",
    "A"
  ],
  "target_states": [
    "TX",
    "IL",
    "CO"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_producer_license_reciprocity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

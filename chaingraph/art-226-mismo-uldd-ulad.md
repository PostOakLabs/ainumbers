# ULDD/ULAD Structural Linter

ULDD Phase 5 / ULAD structural lint of required data points, enumerations, and conditionality rules. Checks field presence against ULDD Phase 5 required set, validates enum values from the public Fannie Mae ULDD Phase 5 Data Stencil and Freddie Mac ULAD Data Dictionary v1.3, enforces ARM-conditional fields, range constraints, and indicator consistency. ULDD Phase 5 mandate effective 2025-07-28. Inputs are bounded structural fields only; loan PII never leaves the browser. Lints public ULDD/ULAD data dictionaries only; does not embed or validate against the membership-licensed MISMO v3.x Reference Model schema. Table version: ULDD-PHASE5-ULAD-1.3-2025-07-28.

- Page: https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.html
- Markdown twin: https://ainumbers.co/chaingraph/art-226-mismo-uldd-ulad.md
- MCP tool: lint_mismo_uldd_ulad (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- loan_data (unknown, required)

## Outputs

- error_count (integer, optional)
- errors (array, optional)
- field_results (array, optional)
- fields_supplied (integer, optional)
- license_note (string, optional)
- lint_pass (boolean, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- uldd_mandate_date (string, optional)
- uldd_phase (string, optional)
- warning_count (integer, optional)
- warnings (array, optional)

## Sample

```json
{
  "loan_data": {
    "loan_purpose_type": "Purchase",
    "amortization_type": "FixedRate",
    "loan_amount": 400000,
    "ltv_pct": 80,
    "occupancy_type": "PrimaryResidence",
    "property_type": "Detached",
    "number_of_units": 1,
    "interest_rate_pct": 6.5,
    "loan_term_months": 360,
    "credit_score": 740,
    "dti_pct": 38,
    "channel_type": "Retail",
    "doc_type": "FullDocumentation"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_mismo_uldd_ulad` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

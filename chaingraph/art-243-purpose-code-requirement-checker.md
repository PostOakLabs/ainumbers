# ISO 20022 Purpose Code Requirement Checker

Given a beneficiary country and payment amount, determines whether ExternalPurpose1Code (Purp/Cd) or ExternalCategoryPurpose1Code (CtgyPurp/Cd) is mandatory per BIS CPMI d218 jurisdiction profiles (UAE, India, Bahrain, Jordan, China, Malaysia mandate purpose codes). Also checks SwiftGo eligibility (amount at most $12,500 USD and ExternalCategoryPurpose1Code in accepted set). Outputs purpose_code_compliant, code_type_required, and swiftgo_eligible.

- Page: https://ainumbers.co/chaingraph/art-243-purpose-code-requirement-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-243-purpose-code-requirement-checker.md
- MCP tool: check_purpose_code_requirement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- beneficiary_country (unknown, required)
- category_purpose_code (unknown, required)
- payment_amount_usd (number, required): Amount in US dollars
- purpose_code (unknown, required)

## Outputs

- category_purpose_code_provided (boolean, optional)
- code_type_required (string, optional)
- issues (array, optional)
- jurisdiction_reason (string, optional)
- jurisdiction_requires_purpose_code (boolean, optional)
- pii_note (string, optional)
- purpose_code_compliant (boolean, optional)
- purpose_code_provided (boolean, optional)
- purpose_format_valid (boolean, optional)
- regulatory_basis (string, optional)
- required_code_types (array, optional)
- swiftgo_accepted_category_codes (array, optional)
- swiftgo_amount_ok (boolean, optional)
- swiftgo_category_ok (boolean, optional)
- swiftgo_eligible (boolean, optional)
- swiftgo_max_usd (integer, optional)
- swiftgo_notes (array, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "beneficiary_country": "AE",
  "payment_amount_usd": 5000,
  "purpose_code": "TRAD",
  "category_purpose_code": "TRAD"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_purpose_code_requirement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

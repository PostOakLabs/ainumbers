# openIDS Homeowners Record Validator

Validates homeowners insurance data records against the openIDS Homeowners Data Standard v1.0 (AAIS / Linux Foundation, November 2025) - the first free open (Apache-2.0) insurance data standard. Checks required sections (policy, insured_location, coverage, premium), required fields per section, policy type (HO-1..HO-8, DP-1..DP-3), date ordering, payment plan, construction type, coverage limit positivity, and PII field detection. NOT an ACORD validator - ACORD XML/AL3 is membership-licensed and is not referenced or reproduced here. ZERO PII: structural/field validation only.

- Page: https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.html
- Markdown twin: https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.md
- MCP tool: validate_openids_homeowners_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- record (unknown, required)

## Outputs

- error_count (integer, optional)
- errors (array, optional)
- not_legal_advice (string, optional)
- pii_fields_found (array, optional)
- pii_note (string, optional)
- record_valid (boolean, optional)
- regulatory_basis (string, optional)
- section_results (object, optional)
- sections_present (integer, optional)
- sections_required (integer, optional)
- standard_version (string, optional)
- table_source (string, optional)
- warning_count (integer, optional)
- warnings (array, optional)

## Sample

```json
{
  "record": {
    "policy": {
      "policy_number": "HOW-2025-001",
      "effective_date": "2025-01-01",
      "expiration_date": "2026-01-01",
      "policy_type": "HO-3"
    },
    "insured_location": {
      "street_address": "123 Main St",
      "city": "Austin",
      "state": "TX",
      "zip_code": "78701",
      "construction_type": "frame"
    },
    "coverage": {
      "dwelling_limit": 350000,
      "other_structures_limit": 35000,
      "personal_property_limit": 175000,
      "liability_limit": 300000
    },
    "premium": {
      "annual_premium": 1850,
      "payment_plan": "annual"
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_openids_homeowners_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

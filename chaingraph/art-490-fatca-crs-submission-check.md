# FATCA/CRS Submission Conformance Check

Evaluates a FATCA/CRS submission record set against a policy-supplied schema version and business-rule set: DocTypeIndic sequencing (the public OECD CRS/FATCA XML Schema v2.0 new/corrected/void enumeration), MessageRefId/DocRefId uniqueness, CorrDocRefId referencing across corrected and voided records, mandatory-identifier structural checks (TIN presence, BirthDate format, address completeness), and the caller's own mandatory_element_rules array keyed by a published error code and element path. A suppression_list (F3) excludes stood-down rule codes from producing any finding at all, with an audit-trail count of what was suppressed. Schema versions and error-code sets are pinned policy inputs, never kernel source. Ahead of the annual Responsible Officer certification; feeds art-491 ro-remediation-closure. Not a validator competing on schema coverage - free FATCA/CRS XML validators already exist - the claim is the sealed, offline-verifiable evidence chain from submission error through remediation to a named RO signature.

- Page: https://ainumbers.co/chaingraph/art-490-fatca-crs-submission-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-490-fatca-crs-submission-check.md
- MCP tool: check_fatca_crs_submission_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- certification_period (unknown, required)
- mandatory_element_rules (array, required)
- records (array, required)
- schema_version (unknown, required)
- submission_id (unknown, required)
- suppressed_rule_codes (array, required)

## Outputs

- certification_period (string, optional)
- fail_count (integer, optional)
- finding_count (integer, optional)
- findings (array, optional)
- note (string, optional)
- record_count (integer, optional)
- schema_version (string, optional)
- submission_id (string, optional)
- suppressed_finding_count (integer, optional)
- suppressed_rule_codes (array, optional)

## Sample

```json
{
  "submission_id": "SUB-2025-US-0001",
  "schema_version": "OECD-CRS-XML-SCHEMA-v2.0",
  "certification_period": "2025",
  "suppressed_rule_codes": [],
  "mandatory_element_rules": [
    {
      "rule_code": "BR-ACCTNUM-001",
      "element_path": "account_number",
      "applies_to": "all",
      "description": "AccountNumber element is required on every record (BR-ACCTNUM-001)."
    }
  ],
  "records": [
    {
      "doc_ref_id": "US2025DOC0001",
      "doc_type_indic": "OECD1",
      "tin": "000000001",
      "birth_date": "1980-01-15",
      "address_street": "1 Synthetic Way",
      "address_city": "Springfield",
      "address_country_code": "US",
      "element_values": {
        "account_number": "ACCT-0001"
      }
    },
    {
      "doc_ref_id": "US2025DOC0002",
      "corr_doc_ref_id": "US2025DOC0001",
      "doc_type_indic": "OECD2",
      "tin": "000000002",
      "birth_date": "1975-06-30",
      "address_street": "2 Synthetic Way",
      "address_city": "Springfield",
      "address_country_code": "US",
      "element_values": {
        "account_number": "ACCT-0002"
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_fatca_crs_submission_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

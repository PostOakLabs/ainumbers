# CFPB 1071 Coverage Check & SBLAR Record Validator

CFPB Section 1071 small business lending rule (Regulation B subpart B, revised final rule published 2026-05-01): determines whether a financial institution is a covered originator by checking its small-business-originations count against the 1,000-origination threshold for each of the two preceding calendar years, and validates a batch of Small Business Lending Application Register (SBLAR) records against a caller-supplied required-field schema. Fixed compliance-date reference: data collection begins 2028-01-01, first SBLAR submission due 2029-06-01. Deterministic threshold comparison and field-presence check only - no filing, no submission, no hardcoded field-list claim beyond the caller's supplied schema.

- Page: https://ainumbers.co/chaingraph/art-475-cfpb-1071-coverage-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-475-cfpb-1071-coverage-check.md
- MCP tool: compute_cfpb_1071_coverage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- originations_year1_count (number, optional): Count
- originations_year2_count (number, optional): Count
- required_sblar_fields (unknown, required)
- sblar_records (unknown, required)

## Outputs

- compliance_dates (object, optional)
- covered (boolean, optional)
- note (string, optional)
- originations_year1_count (integer, optional)
- originations_year2_count (integer, optional)
- regulatory_basis (string, optional)
- required_sblar_fields (array, optional)
- sblar_records (array, optional)
- sblar_summary (object, optional)
- threshold (integer, optional)

## Sample

```json
{
  "originations_year1_count": 1500,
  "originations_year2_count": 1200,
  "required_sblar_fields": [
    "uli",
    "application_date",
    "action_taken"
  ],
  "sblar_records": [
    {
      "record_id": "rec-1",
      "fields": {
        "uli": "X123",
        "application_date": "2028-02-01",
        "action_taken": "originated"
      }
    },
    {
      "record_id": "rec-2",
      "fields": {
        "uli": "X124",
        "application_date": "2028-02-03",
        "action_taken": "denied"
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_cfpb_1071_coverage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

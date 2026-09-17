# SLATE Securities-Loan Report Field Validator

Field-level structural validator for a covered-securities-loan report record against the FINRA Rule 6500-series field spec (loan terms, rate, collateral type, counterparty) that FINRA Rule 6540 - FINRA's implementation of SEC Rule 10c-1a securities-lending transparency reporting (SLATE) - requires. Honestly scoped in the art-397 pattern: this schema-validates structurally (required fields present, enum membership, numeric/date parseability) and is explicitly NOT a full SLATE conformance engine - no cross-record consistency check, no regulatory-timeliness check. Validate-never-transmit: never calls fetch, never calls an RNSA, never simulates submission - readiness is not submission. Reporting compliance date is 2028-09-28 per the SEC's 2025-12-03 exemptive order (post-remand of NAPFM v. SEC, 5th Cir., 2025-08-25) - re-verify against a then-current SEC.gov release before treating that date as load-bearing.

- Page: https://ainumbers.co/chaingraph/art-544-slate-report-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-544-slate-report-validator.md
- MCP tool: validate_slate_report_fields (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- reports (unknown, required)

## Outputs

- compliance_date_note (string, optional)
- field_spec_version (string, optional)
- regulatory_basis (string, optional)
- reports_checked (integer, optional)
- reports_valid (integer, optional)
- scope_note (string, optional)
- violations (array, optional)

## Sample

```json
{
  "reports": [
    {
      "loan_id": "LOAN-1001",
      "effective_date": "2026-08-01",
      "rate_type": "FLAT",
      "rate": 4.25,
      "collateral_type": "CASH",
      "collateral_value": 100000,
      "counterparty_id": "CPTY-77",
      "security_identifier": "037833100",
      "quantity": 5000,
      "loan_type": "NEW"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_slate_report_fields` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

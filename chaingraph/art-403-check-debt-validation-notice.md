# Debt Validation Notice Completeness Checker

Checks a debt-validation-notice content-element checklist against Regulation F 12 CFR 1006.34 (the Model Form B-1 element set) and computes the 30-day validation-period response-window math from a declared mailing date under a declared mailing-to-receipt assumption. Same present/absent checklist shape as the shipped official-statement / Metro2 / X12 linters. Checks that declared elements are present and well-formed, not that disclosed amounts are accurate.

- Page: https://ainumbers.co/chaingraph/art-403-check-debt-validation-notice.html
- Markdown twin: https://ainumbers.co/chaingraph/art-403-check-debt-validation-notice.md
- MCP tool: check_debt_validation_notice (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- asserted_note (string, optional)
- completeness_grade (string, optional)
- compliant (boolean, optional)
- disambiguation (string, optional)
- element_status (object, optional)
- elements_checked (integer, optional)
- gap_count (integer, optional)
- gaps (array, optional)
- itemization_date_valid (boolean, optional)
- regulatory_basis (string, optional)
- response_period (object, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "inputs": {
    "notice_elements": [
      {
        "element": "debt-collector-name",
        "status": "complete"
      },
      {
        "element": "consumer-name",
        "status": "complete"
      },
      {
        "element": "account-number-or-reference",
        "status": "complete"
      },
      {
        "element": "itemization-date",
        "status": "complete"
      },
      {
        "element": "itemized-current-amount",
        "status": "complete"
      },
      {
        "element": "itemization-breakdown",
        "status": "complete"
      },
      {
        "element": "original-creditor-name-if-different",
        "status": "complete"
      },
      {
        "element": "statement-of-dispute-rights-30-day",
        "status": "complete"
      },
      {
        "element": "statement-of-right-to-original-creditor-info",
        "status": "complete"
      },
      {
        "element": "model-form-b1-tear-off",
        "status": "complete"
      }
    ],
    "notice_mailed_date": "2026-07-01",
    "mailing_assumption_days": 5,
    "itemization_date": "2026-06-15"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_debt_validation_notice` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

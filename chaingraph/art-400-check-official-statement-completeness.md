# Municipal Official Statement Completeness Checker

Checks a municipal-bond Official Statement disclosure-element checklist (element present, absent, or incomplete) and continuing-disclosure undertaking presence, per MSRB Rule G-32 (primary-offering disclosure via EMMA) and SEC Rule 15c2-12, including the (b)(5)(i)(C) material-event category list. Same present/absent checklist shape as the shipped GENIUS Sec 4 / MiCA-whitepaper linters. Checks that declared elements are present and well-formed, not that the underlying disclosures are true. Part of the record-integrity family alongside lint_metro2_record (art-398), lint_x12_claim_records (art-399), and validate_form5500_schedules (art-401).

- Page: https://ainumbers.co/chaingraph/art-400-check-official-statement-completeness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-400-check-official-statement-completeness.md
- MCP tool: check_official_statement_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- asserted_note (string, optional)
- completeness_grade (string, optional)
- compliant (boolean, optional)
- continuing_disclosure_undertaking_present (boolean, optional)
- disambiguation (string, optional)
- element_status (object, optional)
- elements_checked (integer, optional)
- gap_count (integer, optional)
- gaps (array, optional)
- material_event_categories_checked (integer, optional)
- material_event_gaps (array, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "inputs": {
    "os_elements": [
      {
        "element": "cover-page",
        "status": "complete"
      },
      {
        "element": "summary-statement",
        "status": "complete"
      },
      {
        "element": "description-of-securities",
        "status": "complete"
      },
      {
        "element": "use-of-proceeds",
        "status": "complete"
      },
      {
        "element": "sources-and-uses-of-funds",
        "status": "complete"
      },
      {
        "element": "description-of-issuer",
        "status": "complete"
      },
      {
        "element": "financial-statements",
        "status": "complete"
      },
      {
        "element": "tax-matters-legal-opinion",
        "status": "complete"
      },
      {
        "element": "risk-factors",
        "status": "complete"
      },
      {
        "element": "litigation-disclosure",
        "status": "complete"
      },
      {
        "element": "underwriting",
        "status": "complete"
      },
      {
        "element": "continuing-disclosure-undertaking",
        "status": "complete"
      }
    ],
    "material_event_categories_covered": [
      "principal-and-interest-payment-delinquencies",
      "non-payment-related-defaults",
      "unscheduled-draws-on-debt-service-reserves",
      "unscheduled-draws-on-credit-enhancements",
      "substitution-of-credit-or-liquidity-providers",
      "adverse-tax-opinions-or-irs-events",
      "modifications-to-rights-of-security-holders",
      "bond-calls",
      "defeasances",
      "release-substitution-or-sale-of-property-securing-repayment",
      "rating-changes",
      "bankruptcy-insolvency-receivership",
      "merger-consolidation-or-sale-of-substantially-all-assets",
      "appointment-of-successor-trustee",
      "incurrence-of-financial-obligation-or-agreement-to-covenants"
    ],
    "continuing_disclosure_undertaking_present": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_official_statement_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

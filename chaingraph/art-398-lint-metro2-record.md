# Metro 2 Credit-Reporting Record Lint

Lints a Metro 2 credit-reporting base-segment record from a PUBLIC SUBSET of the format: field presence/format, account-status and payment-rating code validity, and DOFD (date of first delinquency) cross-field consistency per FCRA 15 U.S.C. Sec 1681c(a)(4)-(5), including the 7-year-plus-180-day obsolescence check. Does not implement the CDIA Credit Reporting Resource Guide (CRRG), a licensed proprietary document - J1/J2/K1-K4 segments are checked as presence flags only. Part of the record-integrity family alongside lint_x12_claim_records (art-399), check_official_statement_completeness (art-400), and validate_form5500_schedules (art-401).

- Page: https://ainumbers.co/chaingraph/art-398-lint-metro2-record.html
- Markdown twin: https://ainumbers.co/chaingraph/art-398-lint-metro2-record.md
- MCP tool: lint_metro2_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- account_status (unknown, required)
- account_type (unknown, required)
- amount_past_due (unknown, required)
- current_balance (unknown, required)
- date_of_first_delinquency (unknown, required)
- date_opened (unknown, required)
- date_reported (unknown, required)
- has_j1_segment (boolean, required)
- has_j2_segment (boolean, required)
- has_k_segment (boolean, required)
- payment_rating (unknown, required)

## Outputs

- compliant (boolean, optional)
- disambiguation (string, optional)
- error_count (integer, optional)
- field_status (object, optional)
- is_delinquent_status (boolean, optional)
- issues (array, optional)
- metro2_subset_score (integer, optional)
- obsolete_per_fcra (boolean, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- subset_coverage_statement (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- warning_count (integer, optional)

## Sample

```json
{
  "account_type": "01",
  "date_opened": "2018-03-15",
  "date_reported": "2026-06-01",
  "current_balance": 0,
  "amount_past_due": 0,
  "account_status": "13",
  "payment_rating": "0",
  "has_j1_segment": false,
  "has_j2_segment": false,
  "has_k_segment": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_metro2_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

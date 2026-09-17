# ERISA Form 5500 Schedule Validator

Validates a Form 5500 schedule-applicability matrix (plan type and size determine required schedules H/I/A/C/G/MB/SB/R), a Schedule H cross-schedule arithmetic tie (ending assets equal beginning assets plus net income minus distributions), and the filing-deadline calculation (plan-year end plus seven months, with the Form 5558 two-and-a-half-month extension). This is form-lint - structural schedule applicability and arithmetic - not retirement or plan-design advice; it sits in the compliance-mechanics lane of the options-shelf constraint, not the advice lane. Part of the record-integrity family alongside lint_metro2_record (art-398), lint_x12_claim_records (art-399), and check_official_statement_completeness (art-400).

- Page: https://ainumbers.co/chaingraph/art-401-validate-form5500-schedules.html
- Markdown twin: https://ainumbers.co/chaingraph/art-401-validate-form5500-schedules.md
- MCP tool: validate_form5500_schedules (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- extension_filed (boolean, required)
- has_insurance_contracts (boolean, required)
- has_party_in_interest_transactions (boolean, required)
- is_multiemployer (boolean, required)
- participant_count (number, required): Count
- plan_type (unknown, required)
- plan_year_end (unknown, required)
- schedule_h_beginning_assets (number, required)
- schedule_h_distributions (number, required)
- schedule_h_ending_assets (number, required)
- schedule_h_net_income (number, required)
- service_provider_comp_over_5000 (boolean, required)

## Outputs

- applicable_deadline (string, optional)
- arithmetic_tie (object, optional)
- compliant (boolean, optional)
- disambiguation (string, optional)
- error_count (integer, optional)
- extended_filing_deadline (string, optional)
- filing_deadline (string, optional)
- is_large_plan (boolean, optional)
- issues (array, optional)
- regulatory_basis (string, optional)
- required_schedules (array, optional)
- shelf_note (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- warning_count (integer, optional)

## Sample

```json
{
  "plan_type": "defined_benefit",
  "is_multiemployer": false,
  "has_insurance_contracts": true,
  "service_provider_comp_over_5000": true,
  "has_party_in_interest_transactions": true,
  "participant_count": 250,
  "plan_year_end": "2025-12-31",
  "extension_filed": false,
  "schedule_h_beginning_assets": 1000000,
  "schedule_h_net_income": 50000,
  "schedule_h_distributions": 20000,
  "schedule_h_ending_assets": 1030000
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_form5500_schedules` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

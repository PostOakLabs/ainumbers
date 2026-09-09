# Deposit Insurance Coverage Determination

Computes the insured amount and the uninsured remainder for deposit accounts grouped by ownership right and capacity, and reports every account whose coverage cannot be calculated from the fields supplied. Balances held in the same ownership right and capacity by the same holder combine before an allowance is applied, so splitting a balance across accounts never creates coverage, and a group receives the largest allowance count stated for it rather than the sum across its accounts, so repeating a beneficiary set across accounts never multiplies coverage. The standard maximum deposit insurance amount is supplied by the caller and no statutory amount is held here: supply none and nothing is estimated, because every record is returned as undeterminable naming that field and the totals report zero insured rather than a guess. No table of part 330 ownership categories or allowance rules is held either. Ownership right and capacity codes are opaque strings used for grouping and reporting only, nothing branches on the text of a code, and how many separate insurance allowances a group is entitled to arrives as a per-record input, because that determination belongs to the institution and its counsel. Money is fixed point in integer minor units throughout, so no floating point operation is performed on a balance and a value that is not an integer is reported rather than coerced or rounded. Every account that cannot be calculated names the field that is missing, so a reader is told which field to go and get rather than being handed a bare undetermined count. Accounts held under alternative recordkeeping are undeterminable by construction rather than by failure, because the beneficial ownership detail sits with a third party. The annual certification that the information technology system was tested during the preceding twelve months is a caller-supplied assertion with a caller-supplied date, echoed unchanged and never computed from a clock, and nothing here verifies that any testing occurred; the signature over it is evaluated as a section 27 approval record at a threshold of one by art-503-build-dual-control-certification. Whether an institution has the two million or more deposit accounts that bring it into scope is a caller declaration and is never asserted here. Stated boundary: this is arithmetic over supplied records. It carries no claim that the Federal Deposit Insurance Corporation would accept the result, it does not serve as a filing, it does not produce the prescribed submission format, and it offers no deposit insurance advice.

- Page: https://ainumbers.co/chaingraph/art-507-determine-deposit-insurance-coverage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-507-determine-deposit-insurance-coverage.md
- MCP tool: determine_deposit_insurance_coverage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- account_records (unknown, required)
- as_of_date (unknown, required)
- certification_assertion (unknown, required)
- covered_institution_declared (unknown, required)
- currency (unknown, required)
- declared_deposit_account_count (unknown, required): Count
- institution_ref (unknown, required)
- minor_unit_scale (unknown, required)
- smdia (unknown, required)

## Outputs

- aggregation_groups (array, optional)
- alternative_recordkeeping_handling (string, optional)
- as_of_date (string, optional)
- boundary (string, optional)
- by_ownership_right_and_capacity (array, optional)
- certification_assertion (object, optional)
- coverage_summary (object, optional)
- covered_institution (object, optional)
- institution_ref (string, optional)
- money_representation (string, optional)
- note (string, optional)
- ownership_code_handling (string, optional)
- rationale (array, optional)
- smdia_applied (integer, optional)
- smdia_basis (string, optional)
- smdia_is_caller_supplied (boolean, optional)
- undeterminable_by_missing_field (array, optional)
- undeterminable_records (array, optional)

## Sample

```json
{
  "as_of_date": "2026-06-30",
  "institution_ref": "IDI-SYNTH-0001",
  "currency": "USD",
  "minor_unit_scale": 100,
  "smdia": 25000000,
  "covered_institution_declared": true,
  "declared_deposit_account_count": 2400000,
  "certification_assertion": {
    "testing_performed_in_preceding_twelve_months": true,
    "assertion_date": "2026-03-31",
    "signer_role": "chief executive officer"
  },
  "account_records": [
    {
      "account_ref": "ACCT-A1",
      "ownership_right_and_capacity": "SGL",
      "insurance_aggregation_key": "HOLDER-1",
      "balance": 12500000
    },
    {
      "account_ref": "ACCT-A2",
      "ownership_right_and_capacity": "SGL",
      "insurance_aggregation_key": "HOLDER-2",
      "balance": 20000000
    },
    {
      "account_ref": "ACCT-A3",
      "ownership_right_and_capacity": "SGL",
      "insurance_aggregation_key": "HOLDER-2",
      "balance": 15000000
    },
    {
      "account_ref": "ACCT-B1",
      "ownership_right_and_capacity": "JNT",
      "insurance_aggregation_key": "HOLDER-3",
      "balance": 9000000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `determine_deposit_insurance_coverage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

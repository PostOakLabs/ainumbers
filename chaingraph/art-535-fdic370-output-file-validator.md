# FDIC Part 370 Output-File Validator

Validates the shape of the institution's own 12 CFR part 370 deposit-insurance-coverage output file (the section 370.10 coverage summary report structure) against its published record layout - required field presence, malformed count/amount values, and a repeated ownership right and capacity code - and ties the file's declared totals to a supplied art-507-determine-deposit-insurance-coverage recompute. A file-shape defect and a totals mismatch are two separate, never-merged findings: a shape problem is checked first and routes to review_required regardless of how the totals compare, and only a clean-shaped file with a totals disagreement routes to escalate. Ownership right and capacity codes stay opaque strings, exactly as in art-507; no table of part 330 ownership categories is held here. Without a supplied art-507 result there is nothing to reconcile against, so the node reports did_not_run naming that precondition rather than assuming a tie-out. Emits a section 27.4 gate-policy value plus a sibling execution_state at a predictable output_payload pointer. Not a filing and not deposit insurance advice.

- Page: https://ainumbers.co/chaingraph/art-535-fdic370-output-file-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-535-fdic370-output-file-validator.md
- MCP tool: validate_fdic370_output_file (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- art507_result (unknown, required)
- as_of_date (unknown, required)
- file_records (unknown, required)
- institution_ref (unknown, required)

## Outputs

- art507_result (object, optional)
- art507_supplied (boolean, optional)
- as_of_date (string, optional)
- boundary (string, optional)
- conforming_row_count (integer, optional)
- decision (object, optional)
- file_structure_errors (array, optional)
- file_totals (object, optional)
- institution_ref (string, optional)
- mismatches (array, optional)
- note (string, optional)
- ownership_code_handling (string, optional)
- rationale (array, optional)
- small_buyer_caveat (string, optional)
- supplied_row_count (integer, optional)
- totals_mismatch (boolean, optional)

## Sample

```json
{
  "as_of_date": "2026-06-30",
  "institution_ref": "IDI-SYNTH-0001",
  "file_records": [
    {
      "row_ref": "FR-1",
      "ownership_right_and_capacity": "SGL",
      "deposit_account_count": 3,
      "distinct_account_holder_count": 2,
      "fully_insured_account_count": 1,
      "accounts_with_uninsured_deposits_count": 2,
      "insured_minor_units": 37500000,
      "uninsured_minor_units": 10000000
    },
    {
      "row_ref": "FR-2",
      "ownership_right_and_capacity": "JNT",
      "deposit_account_count": 1,
      "distinct_account_holder_count": 1,
      "fully_insured_account_count": 1,
      "accounts_with_uninsured_deposits_count": 0,
      "insured_minor_units": 9000000,
      "uninsured_minor_units": 0
    }
  ],
  "art507_result": {
    "fully_insured_account_count": 2,
    "accounts_with_uninsured_deposits_count": 2,
    "insured_minor_units": 46500000,
    "uninsured_minor_units": 10000000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_fdic370_output_file` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

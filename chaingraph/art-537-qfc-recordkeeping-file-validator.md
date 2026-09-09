# QFC Part 371 Recordkeeping File Validator

Validates the shape of the institution's own 12 CFR part 371 qualified-financial-contract recordkeeping file - the position, counterparty, and collateral record set the appendix to part 371 requires - against its published record layout, and ties the file's declared totals to a supplied control-total summary. A file-shape defect and a totals mismatch are two separate, never-merged findings: a shape problem is checked first and routes to review_required regardless of how the totals compare, and only a clean-shaped file with a totals disagreement routes to escalate. Position identifier and counterparty identifier are enumerable low-entropy identifiers salted before this node ever sees them; QFC type and currency code stay opaque strings, with no table of contract-type or currency codes held here. Without a supplied control-total summary there is nothing to reconcile against, so the node reports did_not_run naming that precondition rather than assuming a tie-out. Emits a section 27.4 gate-policy value plus a sibling execution_state at a predictable output_payload pointer. Not a filing and not recordkeeping-adequacy advice.

- Page: https://ainumbers.co/chaingraph/art-537-qfc-recordkeeping-file-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-537-qfc-recordkeeping-file-validator.md
- MCP tool: validate_qfc_recordkeeping_file (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- control_totals (unknown, required)
- file_records (unknown, required)
- institution_ref (unknown, required)

## Outputs

- as_of_date (string, optional)
- boundary (string, optional)
- conforming_row_count (integer, optional)
- control_totals (object, optional)
- control_totals_supplied (boolean, optional)
- decision (object, optional)
- file_structure_errors (array, optional)
- file_totals (object, optional)
- identifier_salting (string, optional)
- institution_ref (string, optional)
- mismatches (array, optional)
- note (string, optional)
- qfc_code_handling (string, optional)
- rationale (array, optional)
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
      "position_id": "sha256-salted@1:aa11",
      "counterparty_id": "sha256-salted@1:cc01",
      "qfc_type": "interest_rate_swap",
      "currency_code": "USD",
      "notional_minor_units": 500000000,
      "collateral_minor_units": 25000000
    },
    {
      "row_ref": "FR-2",
      "position_id": "sha256-salted@1:aa22",
      "counterparty_id": "sha256-salted@1:cc02",
      "qfc_type": "repurchase_agreement",
      "currency_code": "USD",
      "notional_minor_units": 200000000,
      "collateral_minor_units": 21000000
    }
  ],
  "control_totals": {
    "position_count": 2,
    "distinct_counterparty_count": 2,
    "notional_minor_units": 700000000,
    "collateral_minor_units": 46000000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_qfc_recordkeeping_file` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

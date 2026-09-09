# X12 837/835 Healthcare-Claim Records Lint

Lints X12 837 (health-care claim) and 835 (claim payment/remittance advice) ENVELOPE control-number continuity (ISA13/IEA02, GS06/GE02, ST02/SE02) and 835 payment-amount balancing (total paid ties to the sum of claim-level payments, pure arithmetic). FORMAT-ONLY and structurally PHI-IMPOSSIBLE: the schema defines only envelope control numbers, claim/payment identifiers, and monetary amounts - no patient name, DOB, diagnosis, or clinical field exists. Derived from public CMS companion-guide summaries, not the licensed X12 implementation guide. Part of the record-integrity family alongside lint_metro2_record (art-398), check_official_statement_completeness (art-400), and validate_form5500_schedules (art-401).

- Page: https://ainumbers.co/chaingraph/art-399-lint-x12-claim-records.html
- Markdown twin: https://ainumbers.co/chaingraph/art-399-lint-x12-claim-records.md
- MCP tool: lint_x12_claim_records (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claims (unknown, required)
- envelope (unknown, required)
- message_type (unknown, required)
- remittance (unknown, required)

## Outputs

- claim_count (integer, optional)
- compliant (boolean, optional)
- disambiguation (string, optional)
- error_count (integer, optional)
- issues (array, optional)
- message_type (string, optional)
- phi_note (string, optional)
- regulatory_basis (string, optional)
- subset_coverage_statement (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_charge_amount (number, optional)
- warning_count (integer, optional)

## Sample

```json
{
  "message_type": "837",
  "envelope": {
    "isa13": "000000001",
    "iea02": "000000001",
    "gs06": "1",
    "ge02": "1",
    "st02": "0001",
    "se02": "0001"
  },
  "claims": [
    {
      "claim_id": "CLM-1001",
      "charge_amount": 250
    },
    {
      "claim_id": "CLM-1002",
      "charge_amount": 75.5
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_x12_claim_records` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

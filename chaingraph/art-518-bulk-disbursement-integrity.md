# Bulk Disbursement Integrity

Attests that a bulk payment run - salaries, pensions, social transfers, vendor payments - is internally consistent and matches its authorization. Reconciles per-payee records against the authorized control total in both count and value, surfaces duplicate-candidate clusters by a caller-supplied opaque key, reports payee roster movement against the prior run, and flags limit breaches including split-payment candidates (multiple sub-limit payments to one payee ref summing past a declared limit) and destination-tier cap breaches (a payment authorized and funded but unable to land because the destination wallet is at its KYC-tier balance cap). Duplicate, split, and cap-breach flags are candidates for review, never findings of fraud or misconduct. Region-portable: every fact is a caller-declared input, with no country, currency, or scheme hardcoded. Deterministic arithmetic only. Zero network, zero PII - payee is an opaque ref plus an amount and a rail.

- Page: https://ainumbers.co/chaingraph/art-518-bulk-disbursement-integrity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-518-bulk-disbursement-integrity.md
- MCP tool: attest_bulk_disbursement_integrity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- authorized_control_total (unknown, required)
- currency (string, required)
- declared_exclusions (array, required)
- duplicate_key_commitment_scheme (string, required)
- payee_records (array, required)
- per_payee_limit_minor_units (unknown, required)
- per_run_limit_minor_units (unknown, required)
- prior_run_payee_refs (array, required)
- run_reference (string, required)

## Outputs

- absent_this_run (array, optional)
- as_of (string, optional)
- authorized_payee_count (integer, optional)
- authorized_total_display (string, optional)
- authorized_total_minor_units (integer, optional)
- control_total_reconciled (boolean, optional)
- count_break (integer, optional)
- currency (string, optional)
- declared_exclusions (array, optional)
- destination_cap_breaches (array, optional)
- duplicate_candidate_cluster_count (integer, optional)
- duplicate_candidate_clusters (array, optional)
- has_destination_cap_breach (boolean, optional)
- has_limit_breach (boolean, optional)
- has_roster_movement (boolean, optional)
- limit_breaches (array, optional)
- new_this_run (array, optional)
- note (string, optional)
- per_payee_limit_minor_units (integer, optional)
- per_run_limit_breach (string, optional)
- per_run_limit_minor_units (integer, optional)
- prior_run_payee_count (integer, optional)
- rationale (array, optional)
- reconciled_record_count (integer, optional)
- reconciled_total_display (string, optional)
- reconciled_total_minor_units (integer, optional)
- rejected_inputs (array, optional)
- roster_movement_verifiable (boolean, optional)
- run_reference (string, optional)
- split_payment_candidates (array, optional)
- value_break_display (string, optional)
- value_break_minor_units (integer, optional)

## Sample

```json
{
  "run_reference": "RUN-2026-07-31-PENSION",
  "as_of": "2026-07-31",
  "currency": "USD",
  "authorized_control_total": {
    "payee_count": 4,
    "total_minor_units": 400000
  },
  "per_payee_limit_minor_units": 150000,
  "per_run_limit_minor_units": 1000000,
  "payee_records": [
    {
      "payee_ref": "PAYEE-A001",
      "amount_minor_units": 100000,
      "rail": "ach",
      "duplicate_key": "h_9f2c1a"
    },
    {
      "payee_ref": "PAYEE-A002",
      "amount_minor_units": 100000,
      "rail": "ach",
      "duplicate_key": "h_3b7d90"
    },
    {
      "payee_ref": "PAYEE-A003",
      "amount_minor_units": 100000,
      "rail": "mobile_wallet",
      "duplicate_key": "h_51ae22"
    },
    {
      "payee_ref": "PAYEE-A004",
      "amount_minor_units": 100000,
      "rail": "cash_agent",
      "duplicate_key": "h_e40d18"
    }
  ],
  "declared_exclusions": [],
  "prior_run_payee_refs": [
    "PAYEE-A001",
    "PAYEE-A002",
    "PAYEE-A003",
    "PAYEE-A004"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `attest_bulk_disbursement_integrity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

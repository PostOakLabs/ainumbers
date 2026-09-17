# Daily Reconciliation Attestation

Attests that a daily reconciliation duty was discharged over a caller-declared population, rather than computing the reconciliation match itself. Checks population completeness in both count and value (declared population vs matched+unmatched+partially-matched), ages open exceptions against a caller-declared tolerance, and diffs the current exception list against the prior period's carried-forward exception set to detect an exception that disappeared without a documented resolution. Where the prior-period exception set is not supplied at all, continuity is reported as unverifiable rather than falsely clean. Region-portable: every fact is a caller-declared input, with no country, currency, or scheme hardcoded. Deterministic arithmetic only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-516-daily-reconciliation-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-516-daily-reconciliation-attestation.md
- MCP tool: attest_daily_reconciliation (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "reconciliation_date": "2026-07-31",
  "as_of": "2026-07-31",
  "currency": "USD",
  "ageing_tolerance_days": 5,
  "declared_population": {
    "record_count": 1000,
    "control_total_minor_units": 5000000
  },
  "matched": {
    "record_count": 970,
    "total_minor_units": 4850000
  },
  "unmatched": {
    "record_count": 20,
    "total_minor_units": 100000
  },
  "partially_matched": {
    "record_count": 10,
    "total_minor_units": 50000
  },
  "exceptions": [
    {
      "exception_id": "EXC-0001",
      "reason_code": "timing_difference",
      "opened_date": "2026-07-29",
      "amount_minor_units": 60000
    },
    {
      "exception_id": "EXC-0002",
      "reason_code": "duplicate_submission",
      "opened_date": "2026-07-30",
      "amount_minor_units": 40000
    }
  ],
  "prior_period_exceptions": [
    {
      "exception_id": "EXC-0000",
      "reason_code": "timing_difference",
      "opened_date": "2026-07-25"
    }
  ],
  "resolved_exceptions": [
    {
      "exception_id": "EXC-0000",
      "resolution_reason": "matched in overnight batch, evidenced by settlement confirmation SC-2026-0725-11"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `attest_daily_reconciliation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

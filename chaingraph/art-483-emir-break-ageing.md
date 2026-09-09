# EMIR Reconciliation Break Ageing

Diffs a current EMIR reconciliation break set (e.g. from art-482-emir-recon-adjudicator) against the prior cycle's sealed break set by stable break_key, emitting a newly-opened / persisting / newly-closed split, an ageing bucket, a recurrence count, and an escalation-clock status against policy-supplied ageing limits - reusing the art-428-cyber-incident-clock deadline-vs-evaluated_at pattern rather than re-deriving deadline math. Ageing limits and the escalation deadline are per-cycle policy inputs, never hardcoded.

- Page: https://ainumbers.co/chaingraph/art-483-emir-break-ageing.html
- Markdown twin: https://ainumbers.co/chaingraph/art-483-emir-break-ageing.md
- MCP tool: age_emir_reconciliation_breaks (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- current_break_set (array, required)
- policy (unknown, required)
- prior_sealed_break_set (array, required)

## Outputs

- breaks (array, optional)
- escalation_breached_count (integer, optional)
- evaluated_at (string, optional)
- newly_closed (array, optional)
- newly_closed_count (integer, optional)
- newly_opened_count (integer, optional)
- note (string, optional)
- persisting_count (integer, optional)
- total_current (integer, optional)

## Sample

```json
{
  "current_break_set": [
    {
      "break_key": "UTI0002::notional_amount",
      "uti": "UTI0002",
      "field_name": "notional_amount"
    },
    {
      "break_key": "UTI0005::price",
      "uti": "UTI0005",
      "field_name": "price"
    }
  ],
  "prior_sealed_break_set": [
    {
      "break_key": "UTI0002::notional_amount",
      "uti": "UTI0002",
      "field_name": "notional_amount",
      "first_seen_at": "2026-07-10T00:00:00.000Z",
      "recurrence_count": 3
    },
    {
      "break_key": "UTI0009::maturity_date",
      "uti": "UTI0009",
      "field_name": "maturity_date",
      "first_seen_at": "2026-07-20T00:00:00.000Z",
      "recurrence_count": 1
    }
  ],
  "policy": {
    "evaluated_at": "2026-07-27T00:00:00.000Z",
    "ageing_limits": [
      {
        "bucket_name": "0-5d",
        "min_days": 0,
        "max_days": 5
      },
      {
        "bucket_name": "6-10d",
        "min_days": 6,
        "max_days": 10
      },
      {
        "bucket_name": "11-20d",
        "min_days": 11,
        "max_days": 20
      },
      {
        "bucket_name": "21d-plus",
        "min_days": 21,
        "max_days": 999999
      }
    ],
    "escalation_days": 10
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `age_emir_reconciliation_breaks` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

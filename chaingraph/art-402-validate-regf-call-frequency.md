# Reg F Call-Frequency Presumption Validator

Checks a declared debt-collection call log against the two 12 CFR 1006.14(b) Regulation F rebuttable presumptions: more than seven telephone calls to a person on a single debt within any seven consecutive days, and a call placed within seven days after a telephone conversation with that person on that debt. Pure interval counting over declared timestamps under a declared timezone offset; returns per-debt findings and a receipt. Presumptions are rebuttable per 1006.14(b)(3) and this does not determine that harassment occurred.

- Page: https://ainumbers.co/chaingraph/art-402-validate-regf-call-frequency.html
- Markdown twin: https://ainumbers.co/chaingraph/art-402-validate-regf-call-frequency.md
- MCP tool: validate_regf_call_frequency (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- debts (array, optional)
- debts_checked (integer, optional)
- debts_with_quiet_period_presumption (integer, optional)
- debts_with_seven_in_seven_presumption (integer, optional)
- disambiguation (string, optional)
- invalid_call_indices (array, optional)
- regulatory_basis (string, optional)
- timezone_offset_minutes_applied (integer, optional)
- window_days (integer, optional)

## Sample

```json
{
  "inputs": {
    "timezone_offset_minutes": 0,
    "calls": [
      {
        "timestamp": "2026-07-01T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      },
      {
        "timestamp": "2026-07-02T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      },
      {
        "timestamp": "2026-07-03T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      },
      {
        "timestamp": "2026-07-04T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      },
      {
        "timestamp": "2026-07-05T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      },
      {
        "timestamp": "2026-07-06T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      },
      {
        "timestamp": "2026-07-07T09:00:00Z",
        "debt_id": "DEBT-1",
        "connected": false
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_regf_call_frequency` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

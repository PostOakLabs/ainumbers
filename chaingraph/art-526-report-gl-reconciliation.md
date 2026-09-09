# Report-to-General-Ledger Reconciliation

Ties a caller-declared reported figure to a caller-declared general-ledger figure, by account - the only node in this reconciliation programme checked against an independent book of record rather than a second declared value. A designed plug (for example FR 2052a field S.B.6 Carrying Value Adjustment) is a first-class declared input, netted before the residual and never counted as a break. Appendix and supplemental-schedule semantics are versioned policy inputs, never hardcoded. Refuses to run where the requested reporting cadence is finer than the underlying GL schedule's own cadence, and treats a general ledger not yet declared closed as a distinct did_not_run outcome from a genuine tie-out break - the failure that otherwise surfaces only at quarter-end. Emits a §27.4 gate-policy value plus a sibling execution_state at a predictable output_payload pointer. Clause: BCBS 239 §36(c), ECB RDARR Guide §3.5(1)/(2). Not a transaction matcher and not a filing tool.

- Page: https://ainumbers.co/chaingraph/art-526-report-gl-reconciliation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-526-report-gl-reconciliation.md
- MCP tool: reconcile_report_to_general_ledger (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- accounts (array, required)
- appendix_schedule_source (string, required)
- appendix_schedule_version (string, required)
- as_of (unknown, required)
- currency (string, required)
- gl_as_of (unknown, required)
- gl_closed (boolean, required)
- reporting_cadence (unknown, optional)
- schedule_cadence (unknown, optional)
- tolerance_minor_units (number, required)

## Outputs

- as_of (string, optional)
- currency (string, optional)
- appendix_schedule_version (string, optional)
- appendix_schedule_source (string, optional)
- reporting_cadence (string, optional)
- schedule_cadence (string, optional)
- cadence_refused (boolean, optional)
- gl_closed_declared (boolean, optional)
- gl_closed (boolean, optional)
- gl_as_of (string, optional)
- account_count (integer, optional)
- accounts (array, optional)
- breaking_account_count (integer, optional)
- plugged_account_count (integer, optional)
- decision (object, optional)
- rejected_inputs (array, optional)
- rationale (array, optional)
- note (string, optional)

## Sample

```json
{
  "as_of": "2026-07-31",
  "currency": "USD",
  "appendix_schedule_version": "FR2052a-AppVIII-2026Q2",
  "appendix_schedule_source": "FR 2052a Appendix VIII, rev 2026-Q2 (firm-by-firm alignment)",
  "reporting_cadence": "monthly",
  "schedule_cadence": "monthly",
  "gl_closed": true,
  "gl_as_of": "2026-07-31",
  "tolerance_minor_units": 100,
  "accounts": [
    {
      "account_id": "GL-1001",
      "reported_figure_minor_units": 500000000,
      "gl_figure_minor_units": 495000000,
      "designed_plug_minor_units": 5000000,
      "designed_plug_reason_code": "SB6_carrying_value_adjustment"
    },
    {
      "account_id": "GL-1002",
      "reported_figure_minor_units": 120000000,
      "gl_figure_minor_units": 120000000,
      "designed_plug_minor_units": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_report_to_general_ledger` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

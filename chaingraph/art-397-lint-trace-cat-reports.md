# TRACE / CAT Reporting Lint

TRACE (FINRA Rule 6730) trade-report timeliness lint against a caller-declared trading calendar and hours window, computing the reporting deadline from the execution timestamp with weekend/holiday-aware rollover, plus a CAT (Consolidated Audit Trail) equity/option order-event structural format-lint over a representative subset of required fields. Honestly scoped: not a full implementation of the CAT Reporting Technical Specification, and there is no built-in market calendar - weekend days and holidays are supplied by the caller and versioned via constants_version.

- Page: https://ainumbers.co/chaingraph/art-397-lint-trace-cat-reports.html
- Markdown twin: https://ainumbers.co/chaingraph/art-397-lint-trace-cat-reports.md
- MCP tool: lint_trace_cat_reports (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- calendar (unknown, required)
- cat_events (unknown, required)
- execution_timestamp (unknown, required)
- report_timestamp (unknown, required)
- report_window_minutes (number, optional)
- trading_hours (unknown, required)

## Outputs

- cat_events_checked (integer, optional)
- cat_events_valid (integer, optional)
- cat_violations (array, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- rules_version (string, optional)
- trace_result (object, optional)

## Sample

```json
{
  "execution_timestamp": "2026-07-20T14:00:00.000Z",
  "report_timestamp": "2026-07-20T14:05:00.000Z",
  "calendar": {
    "weekend_days": [
      0,
      6
    ],
    "holidays": [],
    "calendar_version": "finra-2026-standard"
  },
  "trading_hours": {
    "start_minutes_utc": 480,
    "end_minutes_utc": 1110
  },
  "report_window_minutes": 15,
  "cat_events": [
    {
      "event_category": "equity",
      "event_type": "NEW_ORDER",
      "event_timestamp": "2026-07-20T14:00:00.000Z",
      "firm_designated_id": "FIRM-1",
      "order_id": "ORD-1",
      "symbol": "ABC",
      "side": "BUY",
      "quantity": 100
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_trace_cat_reports` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Whistleblowing Channel Clock Checker

Pure calendar-clock arithmetic for a whistleblowing channel over caller-declared synthetic dates. Checks the declared acknowledgement date against the 7-calendar-day acknowledgement deadline of Directive (EU) 2019/1937 Art 9(1)(b), and computes the follow-up due date as the declared receipt date plus a caller-declared whole-day basis (the spec fixes the declared basis at 90 days, the Directive's Art 9(1)(f) three-month ceiling rendered as caller-declared days; the caller owns the day-count convention and the kernel never legalises the result). Dates are strict YYYY-MM-DD civil calendar dates parsed and differenced with pure integer civil-day arithmetic - no Date object, no runtime clock: every date is an input, never today. No report register, no case feed, no investigation state, no network: every date and basis is a caller-declared input, never fetched or inferred. This is a clock checker of declared inputs under named rules, NOT a case manager, NOT an assessment of any report, NOT a retaliation or case-state tracker, and NOT legal advice - the not_proven discipline applies. An absent or invalid receipt date, ack date, or basis - or an acknowledgement dated before the report - resolves to a fail-closed payload naming each rejected input, never a silently repaired date. All quantities are whole civil days; a fractional basis is refused, never rounded. Cites Directive (EU) 2019/1937 Art 9(1)(b)/(f) (snapshot research/clause-snapshots/DIR2019-1937-Art9-EUAIAct-Art87-2026-09-04.excerpt.md) and notes, informationally and dated, the AI Act scope extension of Regulation (EU) 2024/1689 Art 87, applicable 2026-08-02.

- Page: https://ainumbers.co/tools/677-whistleblowing-channel-clock.html
- Markdown twin: https://ainumbers.co/tools/677-whistleblowing-channel-clock.md
- MCP tool: compute_whistleblowing_channel_clock (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "report_received": "2026-09-01",
  "ack_sent": "2026-09-05",
  "followup_basis_days": 90
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_whistleblowing_channel_clock` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

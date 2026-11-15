# Cash-Leg Window Exposure

Computes how long a token leg that settles at any hour waits for a cash leg that only moves while a payment rail is open. The caller declares the token leg instant (strict UTC), an evaluation instant, the principal in integer minor units as a decimal string, an optional funding rate in whole basis points, an optional horizon of 1 to 60 days (14 when absent), and exactly one of two calendar forms: a list of UTC open windows, or a rail calendar (weekday window rules with local open and close clock times and day offsets, UTC offsets declared by date range so a daylight-saving change is the caller's statement, holidays as business-day dates with no window, and the dates the table covers). Returns the exposure in seconds, the principal-seconds product as an exact decimal string, the next window open and close, a weekend-crossing flag (any Saturday or Sunday instant in UTC inside the exposure interval), and an optional carry cost (principal times rate times exposure over 10000 times 31536000, actual over 365, rounded half to even). The verdict is ATOMIC_POSSIBLE when the token leg falls inside an open window (a window is open from its open instant up to, not including, its close instant), WINDOWED when a later window opens inside the horizon, and NO_WINDOW_IN_HORIZON otherwise. The node hardcodes no rail calendar and reads no clock; every hour, offset and holiday is a caller-asserted input. Floats, nulls, numeric principals, offsets inside time strings, impossible dates, a missing or doubled calendar, a calendar that does not cover the token day plus the horizon, and an undeclared UTC offset all refuse by named code and nothing is coerced. It computes no balance-sheet saving and names no unannounced product. It does not say which rail a given cash leg uses: for tokenized Treasuries DTCC's own text says distributions and maturities are paid in fiat to Participants' traditional accounts and lists digital cash as a roadmap item for 2027 and beyond, and the caller declares the rail whose hours apply.

- Page: https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.md
- MCP tool: cashleg_window_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "token_leg_time": "2026-10-06T12:00:00Z",
  "as_of": "2026-10-06T12:00:00Z",
  "principal_minor_units": "438000",
  "funding_rate_bp": 300,
  "cash_leg_open_windows": [
    { "open_utc": "2026-10-06T13:00:00Z", "close_utc": "2026-10-06T14:00:00Z" }
  ]
}
```

This sample waits 3600 seconds and the carry cost lands exactly on a half unit (1.5), which rounds half to even to 2.

## Verify

Run the sample policy_parameters through MCP tool `cashleg_window_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

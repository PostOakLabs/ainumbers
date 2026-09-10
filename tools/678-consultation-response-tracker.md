# Consultation Response Tracker

Open/closed roll-up over a caller-declared set of regulatory consultations against a declared as-of date: open count (a consultation whose closes date equals as_of is still open), closed-unresponded count, the ids of missed closes, the whole-day count to the next unresponded close, and an overall verdict (ATTENTION_REQUIRED iff a missed close exists; else ON_TRACK iff an open unresponded consultation exists; else ALL_RESPONDED). Declared-date discipline: as_of is a declared input, never a runtime clock; no register, portal, feed, or calendar is read, and responded is the caller's declaration, never an observation this kernel makes. Absent or malformed as_of, consultation lists, ids, closes dates, or responded flags fail closed with each offending input named. Day deltas are exact whole-day integers (civil-days arithmetic, no Date object); the declared rounding convention is 2dp half-up. Zero network, zero storage, zero clock.

- Page: https://ainumbers.co/tools/678-consultation-response-tracker.html
- Markdown twin: https://ainumbers.co/tools/678-consultation-response-tracker.md
- MCP tool: compute_consultation_response_tracker (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "as_of": "2026-09-03",
  "consultations": [
    {
      "id": "C-1",
      "closes": "2026-10-21",
      "responded": false
    },
    {
      "id": "C-2",
      "closes": "2026-08-30",
      "responded": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_consultation_response_tracker` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

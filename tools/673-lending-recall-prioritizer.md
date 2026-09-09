# Lending Recall Prioritizer

Deterministic ranking arithmetic over a caller-declared synthetic recall queue. Ranks declared recalls by due date ascending, then declared quantity ascending, then declared id ascending (a deterministic total order), and flags a recall urgent when its due date is 0 or 1 day after the caller-declared as_of date (due-within-one-day); past-due and further-out recalls are ranked but never flagged. Dates are strict YYYY-MM-DD calendar dates parsed and differenced with pure integer civil-day arithmetic - no Date object, no runtime clock: as_of is an input, never today. No securities-lending tape, no borrow list, no cutoff feed, no register, no network: every recall, date, and quantity is a caller-declared input, never fetched or inferred. This is a prioritizer of declared inputs under named rules, NOT live recall data, NOT an instruction to recall, return, or borrow any security, and NOT a check of any live feed - the not_proven discipline applies. An absent or invalid as_of, recall list, id, due date, or quantity resolves to a fail-closed payload naming each rejected input, never a silently repaired queue. Settled ranking arithmetic; it cites no external standard.

- Page: https://ainumbers.co/tools/673-lending-recall-prioritizer.html
- Markdown twin: https://ainumbers.co/tools/673-lending-recall-prioritizer.md
- MCP tool: compute_lending_recall_prioritizer (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "as_of": "2026-09-03",
  "recalls": [
    {
      "id": "R-A",
      "due": "2026-09-04",
      "qty": 10000
    },
    {
      "id": "R-B",
      "due": "2026-09-08",
      "qty": 2000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_lending_recall_prioritizer` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

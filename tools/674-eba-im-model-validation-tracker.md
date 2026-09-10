# EBA IM-Model Validation Tracker

Deterministic roll-up arithmetic over a caller-declared internal-model inventory. Counts the declared inventory by status (submitted, approved, rejected), lists pending submission ids in declared order, ages each pending submission in whole days from its declared submitted date to the declared as_of date, and issues an overall verdict under a named aging rule: TRACKING_EMPTY when no submitted or approved models are declared, TRACKING_AGED when any pending submission is older than 180 days at as_of, TRACKING_CURRENT otherwise. No register, no SSR tape, no cutoff feed, no network, no clock: every id, status, date, and the as_of snapshot are caller-declared inputs, never fetched or inferred. This is a tracker of declared-inventory arithmetic, NOT a regulatory determination, NOT advice on any application, and NOT a check of any supervisor register - the not_proven discipline applies. An absent or invalid as_of, model entry, id, status, or submitted date resolves to a fail-closed payload naming each rejected input, never a silently repaired inventory. Settled arithmetic (counting and calendar-day aging); it cites no external standard.

- Page: https://ainumbers.co/tools/674-eba-im-model-validation-tracker.html
- Markdown twin: https://ainumbers.co/tools/674-eba-im-model-validation-tracker.md
- MCP tool: compute_eba_im_model_validation_tracker (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "as_of": "2026-09-03",
  "models": [
    {
      "id": "IM-1",
      "status": "submitted",
      "submitted": "2026-06-01"
    },
    {
      "id": "IM-2",
      "status": "approved",
      "submitted": "2026-02-10"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_eba_im_model_validation_tracker` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

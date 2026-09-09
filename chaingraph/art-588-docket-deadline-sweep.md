# Docket Deadline Sweep

Sweeps a caller-declared docket - a flat list of {date, action, type, source, done} deadline records, the structured shape practitioners already keep in a spreadsheet, calendar, or practice-management export - against a caller-declared as-of date, and bands every record OVERDUE, DUE_SOON, SCHEDULED, DONE, or INDETERMINATE. Shows the weekend/holiday roll derivation step by step for each record's actual due date, using roll rules (roll_weekends, roll_direction, holiday_dates) that are always declared caller inputs with labeled defaults, never an encoded jurisdiction rules table - baking one in would be a standing-data-duty trap and UPL-adjacent. FRCP 6(a)(1)(C) is cited in-page only as a dated, structural EXAMPLE of what a roll rule looks like, never as an encoded ruleset for any jurisdiction. A record marked done:true is retained and reported DONE, never dropped - the sweep is a receipt over the full declared docket at one as-of moment, not a filtered view of what remains open. Flags any two records that declare the same action on different dates as a conflict worth a human look. The due-soon banding threshold is a declared input with a labeled default (7 days). Gate policy is review_required when any record is OVERDUE or INDETERMINATE or a conflict exists, otherwise auto_pass; did_not_run when the as-of date, the sweep's own anchor, is absent - it is never defaulted. Not legal advice, not a calendaring system of record, and not a reminder or scheduling service: it recomputes bands and roll derivations over a caller-declared snapshot, and does not source, generate, or independently verify any deadline. Attribution: deadline-record shape design borrow from CounselOS's structured deadline tracker (eigenlegal/counsel-os, MIT).

- Page: https://ainumbers.co/chaingraph/art-588-docket-deadline-sweep.html
- Markdown twin: https://ainumbers.co/chaingraph/art-588-docket-deadline-sweep.md
- MCP tool: sweep_docket_deadlines (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- due_soon_days_threshold (number, required)
- records (array, required)
- roll_rule (unknown, required)

## Outputs

- decision (object, optional)
- as_of_date (string, optional)
- due_soon_days_threshold (integer, optional)
- due_soon_days_threshold_is_default (boolean, optional)
- roll_rule (object, optional)
- record_count (integer, optional)
- records (array, optional)
- conflicts (array, optional)
- sweep_summary (object, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- clause_note (string, optional)
- not_legal_advice_note (string, optional)

## Sample

```json
{
  "as_of_date": "2026-08-08",
  "due_soon_days_threshold": 7,
  "roll_rule": {
    "roll_weekends": true,
    "roll_direction": "forward",
    "holiday_dates": [
      "2026-08-10"
    ]
  },
  "records": [
    {
      "date": "2026-08-08",
      "action": "File answer",
      "type": "filing",
      "source": "court order",
      "done": false
    },
    {
      "date": "2026-08-09",
      "action": "Serve discovery responses",
      "type": "discovery",
      "source": "FRCP 26",
      "done": false
    },
    {
      "date": "2026-07-01",
      "action": "Initial disclosures",
      "type": "discovery",
      "source": "FRCP 26(a)",
      "done": true
    },
    {
      "date": "2026-09-15",
      "action": "Pretrial conference",
      "type": "hearing",
      "source": "scheduling order",
      "done": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `sweep_docket_deadlines` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Allocation/Affirmation Conformance Checker

Checks allocation and confirmation/affirmation events against the ESMA CSDR SDR RTS 23:00 CET trade-date rule and the machine-readable-format mandate (binding Dec 2026). Computes per-event pass/fail and batch on-time rate.

- Page: https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.md
- MCP tool: check_allocation_affirmation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cutoff_local (unknown, optional)
- events (unknown, optional)

## Outputs

- cutoff_applied (string, optional)
- cutoff_timezone (string, optional)
- dual_date_note (string, optional)
- events_flagged (array, optional)
- format_nonconformance_count (integer, optional)
- note (string, optional)
- on_time_events (integer, optional)
- on_time_rate (integer, optional)
- reference (object, optional)
- total_events (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_allocation_affirmation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

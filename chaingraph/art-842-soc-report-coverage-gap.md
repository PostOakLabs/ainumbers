# SOC Report Coverage and Bridge Gap

Recomputes coverage and gap arithmetic from declared values. It does not read the SOC report, does not assess whether any control is effective, and is not an audit opinion. From a declared report type (type 1 or type 2), declared period start and end, declared opinion type and exception count, the user entity's declared fiscal year-end and as-of date, a declared list of complementary user entity control ids each with the customer's mapped control id or null, and a declared list of subservice organisation ids each marked carved out or inclusive, it returns the uncovered control ids and counts, whether the report period covers the fiscal year-end, the bridge gap in whole days from period end to year-end (zero when covered), the carved-out subservice ids that need their own report, the days from period end to the as-of date, and flags for any opinion other than unmodified or any non-zero exception count. A missing required fact returns INDETERMINATE and is never guessed. Dates are strict ISO calendar dates and impossible dates are refused. Ids must match a short lowercase identifier pattern; an email-like or name-like string is refused with an explicit code. Free text is not accepted. A type 1 report describes a point in time and the node flags it rather than treating it as operating coverage. It decides nothing about which controls are complementary and does not reproduce any report or standard text.

- Page: https://ainumbers.co/chaingraph/art-842-soc-report-coverage-gap.html
- Markdown twin: https://ainumbers.co/chaingraph/art-842-soc-report-coverage-gap.md
- MCP tool: compute_soc_report_coverage_gap (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "report_type": "type2",
  "period_start": "2025-01-01",
  "period_end": "2025-12-31",
  "opinion_type": "unmodified",
  "exception_count": 0,
  "fiscal_year_end": "2025-12-31",
  "as_of_date": "2026-02-15",
  "cuecs": [
    {
      "id": "cuec-01",
      "mapped_control_id": "ctl-100"
    },
    {
      "id": "cuec-02",
      "mapped_control_id": "ctl-101"
    },
    {
      "id": "cuec-03",
      "mapped_control_id": "ctl-102"
    }
  ],
  "subservice_orgs": [
    {
      "id": "sub-hosting",
      "treatment": "inclusive"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_soc_report_coverage_gap` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# FATCA/CRS RO Remediation Closure Tracker

Tracks the returned notification set for a FATCA/CRS certification period (ICMM-style error notifications, CRS status messages) against the firm's own remediation records: per-notification open/closed/overdue status, resubmission linkage naming which corrected DocRefId closes which notification, closure coverage percentage, and a certification-period readiness verdict against a declared cut-off date. Reuses the art-428-cyber-incident-clock decision-tree attestation-slot pattern (item_state/exception vocabulary); no new notification-clock arithmetic is invented. Consumes art-490 fatca-crs-submission-check findings as the error source in the fatca-ro-certification-cycle chain. Feeds the Responsible Officer's certification evidence bundle - never claims to itself satisfy an IRS or competent-authority filing requirement.

- Page: https://ainumbers.co/chaingraph/art-491-ro-remediation-closure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-491-ro-remediation-closure.md
- MCP tool: track_fatca_crs_ro_remediation_closure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- certification_period (unknown, required)
- cutoff_at (unknown, required)
- evaluated_at (unknown, required)
- notifications (array, required)
- remediation_records (array, required)

## Outputs

- certification_period (string, optional)
- closed_count (integer, optional)
- closure_coverage_pct (integer, optional)
- cutoff_at (string, optional)
- determinations (array, optional)
- evaluated_at (string, optional)
- note (string, optional)
- notification_count (integer, optional)
- open_count (integer, optional)
- overdue_count (integer, optional)
- readiness_verdict (string, optional)

## Sample

```json
{
  "certification_period": "2025",
  "cutoff_at": "2026-07-01T00:00:00Z",
  "evaluated_at": "2026-06-15T00:00:00Z",
  "notifications": [
    {
      "notification_id": "NOTIF-0001",
      "notification_code": "ICMM-TYPE1-RECOVERABLE",
      "doc_ref_id": "US2025DOC0001"
    },
    {
      "notification_id": "NOTIF-0002",
      "notification_code": "CRS-STATUS-REJECTED",
      "doc_ref_id": "US2025DOC0002"
    }
  ],
  "remediation_records": [
    {
      "notification_id": "NOTIF-0001",
      "resubmitted_doc_ref_id": "US2025DOC0001-CORR1",
      "resubmitted_at": "2026-05-01T00:00:00Z"
    },
    {
      "notification_id": "NOTIF-0002",
      "resubmitted_doc_ref_id": "US2025DOC0002-CORR1",
      "resubmitted_at": "2026-05-10T00:00:00Z"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `track_fatca_crs_ro_remediation_closure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# EMIR Reporting Readiness Diagnostic

Grade a firm EMIR Refit reporting readiness across five dimensions: ISO 20022 format cutover, UPI sourcing via ANNA DSB, UTI sharing SLA (10:00 CET T+1), reconciliation tolerance configuration (148-field set, 2026 escalation), and lifecycle action-type controls. Returns an A-F grade and a gap list. Terminal node of the emir-reconciliation-and-lifecycle chain; exports readiness attestation with execution_hash.

- Page: https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-158-emir-reporting-readiness-diagnostic.md
- MCP tool: run_emir_reporting_fit (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "iso20022_cutover_done": true,
  "upi_sourcing_configured": true,
  "uti_sharing_sla_met": true,
  "reconciliation_tolerance_set": true,
  "lifecycle_action_controls": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_emir_reporting_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# EMIR Counterparty Pairing Reconciler

Pair two counterparties EMIR Refit reports by UTI and reconcile the caller-supplied matching-field set (up to 148 fields per the 2026 escalation) within a configurable per-field numeric tolerance. Identifies reconciliation breaks so a firm catches the pairing failure before the Trade Repository rejects it. Feeds lifecycle event validator (art-157).

- Page: https://ainumbers.co/chaingraph/art-156-emir-counterparty-pairing-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-156-emir-counterparty-pairing-reconciler.md
- MCP tool: reconcile_emir_pairing (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "report_a": {
    "uti": "UTI-TEST-001",
    "notional": 1000000,
    "asset_class": "IR"
  },
  "report_b": {
    "uti": "UTI-TEST-001",
    "notional": 1000000,
    "asset_class": "IR"
  },
  "matching_fields": [
    "notional",
    "asset_class"
  ],
  "numeric_tolerance_pct": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_emir_pairing` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

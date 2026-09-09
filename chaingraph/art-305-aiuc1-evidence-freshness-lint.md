# AIUC-1 Evidence Freshness Lint

Freshness lint keyed to the AIUC-1 quarterly re-test cadence: flags any control whose newest receipt is more than 90 days old and computes cert_expiry (cert_anniversary plus 12 months) with cert_expired / cert_expiring_within_days flags. Pure civil-calendar day-count arithmetic, never a Date object, so the verdict is byte-identical across browser, server, and zkVM guest. Freshness/expiry flags only, never a certification claim. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-305-aiuc1-evidence-freshness-lint.html
- Markdown twin: https://ainumbers.co/chaingraph/art-305-aiuc1-evidence-freshness-lint.md
- MCP tool: lint_insurance_evidence_freshness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- cert_anniversary (unknown, required)
- controls (unknown, required)

## Outputs

- as_of (string, optional)
- cert_expired (boolean, optional)
- cert_expiring_within_days (boolean, optional)
- cert_expiry (string, optional)
- insufficient_evidence (boolean, optional)
- stale_controls (array, optional)
- stale_count (integer, optional)

## Sample

```json
{
  "as_of": "2026-07-14",
  "cert_anniversary": "2026-01-10",
  "controls": [
    {
      "control_id": "AIUC-A-01",
      "newest_receipt_at": "2026-07-01"
    },
    {
      "control_id": "AIUC-B-01",
      "newest_receipt_at": "2026-06-20"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_insurance_evidence_freshness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

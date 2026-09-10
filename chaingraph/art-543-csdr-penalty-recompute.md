# CSDR Penalty Recompute (Caller Reference Price)

Per-ISIN/day CSDR cash-penalty recompute over a caller-declared open-fails set: selects the RTS asset-class/penalty-type daily rate (CSDR-RTS-2025-10, ESMA Final Report 13 Oct 2025), applies fail duration to a caller-supplied reference_price and quantity, credits partial settlement proportionally, and sums forward penalty exposure across the fails set. Fixes art-78-csdr-penalty-calculator's reachability defect - art-78 priced off notional with no shipped pack able to feed it a differing reference_price; this node's schema instead requires a caller-supplied reference_price per fail. art-78 keeps its own identity and chain wiring unchanged. Supports an optional OCG Standard section 25 ocg-private-input@1 declaration (sha256-salted@1) for the ISIN and counterparty_id per fail, since a small ISIN/counterparty universe is enumerable by table lookup.

- Page: https://ainumbers.co/chaingraph/art-543-csdr-penalty-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-543-csdr-penalty-recompute.md
- MCP tool: recompute_csdr_penalty (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- open_fails (array, required)
- rate_table_version (string, required)
- recompute_id (string, required)

## Outputs

- decision (object, optional)
- determinations (array, optional)
- fail_count (integer, optional)
- note (string, optional)
- rate_table_version (string, optional)
- recompute_id (string, optional)
- rejected_inputs (array, optional)
- total_penalty_exposure (integer, optional)

## Sample

```json
{
  "recompute_id": "DEMO-CSDR-2026Q3",
  "rate_table_version": "CSDR-RTS-2025-10",
  "open_fails": [
    {
      "fail_id": "FAIL-1",
      "isin": "DE000TEST001",
      "asset_class": "equity",
      "penalty_type": "sefp",
      "reference_price": 100,
      "quantity": 1000,
      "fail_days": 3,
      "partial_settled_pct": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_csdr_penalty` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

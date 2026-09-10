# Rule 605 Publication Composer

Rule 605 publication composer over caller-declared best-ex/669-shaped inputs: the effective-vs-quoted spread ratio (eq_ratio, 2dp half-up), the covered-order roll-up echoes (declared orders_covered and shares_covered), and a publication-row builder for declared categories. Declared-input discipline: covered orders, covered shares, and spread statistics are your declarations, never observations this kernel makes; no market data, tape, venue, or order-management system is read. PUBLICATION_ROWS_BUILT is a composition verdict, not an obligation assessment. Absent or invalid inputs fail closed and are named. No network, no storage, no clock.

- Page: https://ainumbers.co/tools/682-rule-605-publication-composer.html
- Markdown twin: https://ainumbers.co/tools/682-rule-605-publication-composer.md
- MCP tool: compute_rule_605_publication_composer (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "orders_covered": 1200,
  "shares_covered": 450000,
  "avg_effective_spread_bps": 3.2,
  "avg_quoted_spread_bps": 4
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_rule_605_publication_composer` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

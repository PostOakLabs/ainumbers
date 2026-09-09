# Best-Execution Evidence Pack

Compiles a caller-declared best-execution monitoring evidence pack: the fill-weighted average price improvement in basis points across declared per-venue fills (2dp half-up), the list of declared negative-improvement venues in declared order, and an overall verdict (REVIEW_ITEM_FLAGGED iff a negative-improvement venue is declared; else WITHIN_POLICY). Declared-fill discipline: per-venue fill counts and improvements are the caller declarations, never observations this kernel makes; no order store, venue connection, or fill observer is read. Basis: Commission Delegated Regulation (EU) 2026/825 on order execution policies (MiFIR review package; replaces discontinued RTS 27/28 published-table reporting with internal evidence), which applies from 12 February 2028 (measured 2026-09-05; derive: OJ publication plus the stated application period per the staging spec note). Absent or invalid venue records fail closed with each offending input named. Zero network, zero storage, zero clock.

- Page: https://ainumbers.co/tools/681-best-execution-evidence-pack.html
- Markdown twin: https://ainumbers.co/tools/681-best-execution-evidence-pack.md
- MCP tool: compute_best_execution_evidence_pack (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "venues": [
    {
      "venue": "V1",
      "fills": 60,
      "avg_improvement_bps": 2.1
    },
    {
      "venue": "V2",
      "fills": 40,
      "avg_improvement_bps": -0.4
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_best_execution_evidence_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

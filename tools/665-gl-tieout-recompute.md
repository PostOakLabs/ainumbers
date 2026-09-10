# GL Tie-Out Recompute

Independently recomputes subledger-to-GL tie-out totals from a caller-supplied posted ledger and the caller's own declared product_code -> gl_account_code chart-of-accounts mapping. Single-source mode sums ledger rows per GL account code for a stated period and diffs the recomputed totals against caller-supplied reported trial-balance figures. Diff mode runs the same summation independently over two full ledger sources (for example a legacy-core export and a new-core export covering the same period during a core conversion) and diffs the two recomputed totals against each other, symmetrically, with no side asserted correct - both figures are labeled source_a / source_b. The chart-of-accounts mapping is a caller-declared input, never chosen or inferred. Verdict is MATCHES, DIVERGES (with per-account-code deltas), or INDETERMINATE whenever a required input - the mode, a usable ledger, a usable mapping, or a comparison side - is absent. This is internal-control arithmetic (summation and diff), not an accounting-standards implementation; it cites no external standard. Recompute and receipt only - never a claim of core-vendor endorsement, a vendor audit, or that either side's figure is legally or operationally correct.

- Page: https://ainumbers.co/tools/665-gl-tieout-recompute.html
- Markdown twin: https://ainumbers.co/tools/665-gl-tieout-recompute.md
- MCP tool: compute_gl_tieout_recompute (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "period_label": "2026-08"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_gl_tieout_recompute` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

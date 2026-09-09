# Intercompany Elimination and Netting Workflow

Deterministic intercompany elimination and netting arithmetic over caller-declared synthetic entity pairs. For each declared pair the kernel compares the receivable declared by entity a against the payable declared by entity b (both rounded to 2 decimal places, half-up): equal amounts form a matched pair; unequal amounts are listed as a mismatch with their difference. The kernel reports matched and mismatched pair counts, the elimination total (sum of the smaller side of every pair), the unmatched residual (sum of mismatch differences), a full trace, and an overall GAPS_FOUND or ALL_MATCHED verdict. Pure matching arithmetic: not legal advice, not an audit opinion, not a settlement instruction: nothing is posted, netted, or paid anywhere, and no counterparty is contacted. No runtime clock: any as-of dating is a caller-declared input.

- Page: https://ainumbers.co/tools/684-intercompany-elimination-netting.html
- Markdown twin: https://ainumbers.co/tools/684-intercompany-elimination-netting.md
- MCP tool: compute_intercompany_elimination_netting (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "pairs": [
    {
      "a": "SUB-1",
      "b": "SUB-2",
      "a_receivable": 50000,
      "b_payable": 50000
    },
    {
      "a": "SUB-1",
      "b": "SUB-3",
      "a_receivable": 20000,
      "b_payable": 18000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_intercompany_elimination_netting` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

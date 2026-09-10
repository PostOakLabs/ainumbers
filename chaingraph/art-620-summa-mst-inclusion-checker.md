# Summa MST Inclusion Checker

Paste a published Merkle-sum-tree root (hash + sum) and an inclusion proof for one leaf; verifies membership AND local balance-sum-chain consistency entirely offline, client-side. Independently recomputes both the hash chain and the sum chain from the leaf to the root over the pasted proof path - never trusting the pasted root as an oracle for itself - and rejects any negative balance or any balance/sum exceeding a declared MAX_BALANCE domain bound anywhere in the path, closing the Maxwell eprint 2022/043 'broken MST' negative-balance-cancellation hazard the same way Summa's own circuit does with a RangeCheckChip, applied here at the application layer instead of inside a ZK circuit. Verify-only: reports leaf inclusion and local range-consistency, never a solvency or reserve-sufficiency claim.

- Page: https://ainumbers.co/chaingraph/art-620-summa-mst-inclusion-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-620-summa-mst-inclusion-checker.md
- MCP tool: verify_summa_mst_inclusion (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "root": {
    "hash": "5d967f108c4cc8e9ea17607ac5d0454655967e2657ad77cefc295903e0aae551",
    "sum": "300"
  },
  "max_balance": "1000000000000000000",
  "proof": {
    "leaf": {
      "id": "aa11",
      "balance": "100"
    },
    "path": [
      {
        "side": "right",
        "sibling_hash": "3a0a2ec5cce1770bde00fe2db329d42aaa99b8ee041692a8e40a897586ad1f0b",
        "sibling_sum": "200"
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_summa_mst_inclusion` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

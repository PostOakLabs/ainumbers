# Summa MST Liability Aggregator

Given up to 16 (id, balance) leaf entries, deterministically builds a SHA-256 Merkle-sum-tree (Summa's node layout: hash=H(id,balance) and sum=balance at each leaf; hash=H(left.sum+right.sum,left.hash,right.hash) and sum=left.sum+right.sum at each middle node, pattern-borrowed from Summa/PSE's proof-of-reserves design, no code vendored) and emits the root commitment plus every leaf's full inclusion proof. Applies Maxwell's (eprint 2022/043 §4.1) mandatory range-check mitigation on the input side: rejects any negative balance or balance exceeding the declared MAX_BALANCE before building the tree. The generator counterpart to the MST inclusion checker (art-620), whose output_payload proofs are consumable directly as that tool's input. Verify-only perimeter: commits to whatever balances it is given, never asserts those balances reflect real reserves.

- Page: https://ainumbers.co/chaingraph/art-621-summa-mst-liability-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-621-summa-mst-liability-aggregator.md
- MCP tool: aggregate_summa_mst_liabilities (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "leaves": [
    {
      "id": "acct-0001",
      "balance": "5000000"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_summa_mst_liabilities` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

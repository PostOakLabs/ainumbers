# Compile Rebalance Evidence Pack

Packages one rebalance event, the current period's constituent set and weight set, plus the prior period's for diffing, into a regulator-shaped bundle: what changed (additions/removals/weight deltas), citing the underlying art-557/art-645 receipts rather than recomputing them. This is the vertical's answer to a BMR administrator's-oversight-function record and a SEBI benchmark-administrator disclosure pack. HARD FENCE: this bundle CITES the referenced receipts (execution_hash + tool_id); it does not re-run or independently verify the weighting arithmetic against a third-party feed, and it makes no claim of BMR/SEBI compliance, informative citation only. The current/prior constituent and weight rows used for the diff are caller-supplied and asserted (zero-egress), same fence as art-557/art-645. Third entry of the Financial Index/Benchmark Administrator Lineage family. EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 13(1) and SEBI (Index Providers) Regulations, 2024 Reg 19(2)/19(3) citations informative only.

- Page: https://ainumbers.co/chaingraph/art-646-compile-rebalance-evidence-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-646-compile-rebalance-evidence-pack.md
- MCP tool: compile_rebalance_evidence_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- current (unknown, required)
- index_id (unknown, optional)
- prior (unknown, required)
- rebalance_date (unknown, optional)

## Outputs

- additions (array, optional)
- cited_receipts (array, optional)
- fence (string, optional)
- index_id (string, optional)
- not_proven (array, optional)
- rebalance_date (string, optional)
- regulatory_framework (string, optional)
- removals (array, optional)
- structural_error (string, optional)
- weight_deltas (array, optional)

## Sample

```json
{
  "index_id": "IDX-DEMO-100",
  "rebalance_date": "2026-08-05",
  "current": {
    "constituents_ref": {
      "execution_hash": "sha256:aaa111",
      "tool_id": "art-557-record-index-constituents"
    },
    "constituents": [
      {
        "security_id": "SEC-A"
      },
      {
        "security_id": "SEC-B"
      }
    ],
    "weights_ref": {
      "execution_hash": "sha256:bbb222",
      "tool_id": "art-645-compute-index-weights"
    },
    "weights": [
      {
        "security_id": "SEC-A",
        "weight": 0.6
      },
      {
        "security_id": "SEC-B",
        "weight": 0.4
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compile_rebalance_evidence_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

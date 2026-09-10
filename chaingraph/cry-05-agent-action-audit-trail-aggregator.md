# Agent-Action Audit-Trail Aggregator

The regulatory receipt. Aggregates N execution_hashes from an agent session into one SHA-256 Merkle-root session receipt with per-leaf inclusion proofs and an ordered chain-depth map. Sets session_receipt_root. The tamper-evident audit object for EU AI Act Art. 12 record-keeping + DORA. Consumes ANY ChainGraph artifact; feeds CRY-04, PTG-01.

- Page: https://ainumbers.co/chaingraph/cry-05-agent-action-audit-trail-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/cry-05-agent-action-audit-trail-aggregator.md
- MCP tool: aggregate_execution_receipts (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- artifacts (array, required)

## Outputs

- aggregator_chain_depth (integer, optional)
- all_proofs_verified (boolean, optional)
- max_chain_depth (integer, optional)
- merkle_root (string, optional)
- n_receipts (integer, optional)
- receipts (array, optional)
- session_receipt_root (string, optional)
- tree_depth (integer, optional)

## Sample

```json
{
  "artifacts": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_execution_receipts` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

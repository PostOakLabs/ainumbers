# ETR Possession-Chain Receipt Builder

Builds a hash-chained possession-receipt evidence pack for an electronic transferable record (ETR) under UNCITRAL MLETR Art. 10/11: given the ETR's own document digest and an ordered set of control-transfer events (from_holder, to_holder, timestamp, signature - all as supplied), each receipt binds the prior receipt's hash, so reordering, inserting, or deleting a transfer breaks the chain. Also checks holder-to-holder continuity and timestamp ordering, and computes a SHA-256 Merkle root over the chain - a portable evidence pack a holder can present to a bank or court. Does not itself assess MLETR Art. 10/11 singularity/exclusive-control legal elements; that verdict is check_etr_control_evidence (art-352).

- Page: https://ainumbers.co/chaingraph/art-353-etr-possession-chain-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-353-etr-possession-chain-builder.md
- MCP tool: build_etr_possession_chain (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- control_transfer_events (array, required)
- document_digest (unknown, required)
- initial_holder (unknown, required)

## Outputs

- chain_continuous (boolean, optional)
- continuity_breaks (array, optional)
- document_digest (string, optional)
- event_count (integer, optional)
- final_holder (string, optional)
- merkle_root (string, optional)
- note (string, optional)
- possession_receipts (string, optional)
- timestamp_order_valid (boolean, optional)

## Sample

```json
{
  "document_digest": "sha256:0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0aa0",
  "control_transfer_events": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_etr_possession_chain` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

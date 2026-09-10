# Merkle Batch Verifier

Batch-verifies Merkle inclusion proofs using SHA-256 over payment batches, settlement message sets, and ISO 20022 sets. Zero-egress, browser-local. DORA Art. 12 audit-trail integrity.

- Page: https://ainumbers.co/chaingraph/cry-04-merkle-batch-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/cry-04-merkle-batch-verifier.md
- MCP tool: verify_merkle_batch (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- merkle_root (unknown, required)
- proof_entries (array, required)

## Outputs

- batch_integrity (string, optional)
- failed_count (integer, optional)
- invalid_count (integer, optional)
- pass_rate (integer, optional)
- results (array, optional)
- total (integer, optional)
- verified_count (integer, optional)

## Sample

```json
{
  "proof_entries": [],
  "merkle_root": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_merkle_batch` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

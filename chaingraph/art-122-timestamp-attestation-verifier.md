# Timestamp Attestation Verifier

Recompute the document integrity anchor, confirm the document hash and timestamp claim match and the algorithm is consistent. Terminal stage of document-integrity-anchor chain.

- Page: https://ainumbers.co/chaingraph/art-122-timestamp-attestation-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-122-timestamp-attestation-verifier.md
- MCP tool: verify_timestamp_attestation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- document_hash (unknown, optional)
- expected_algorithm (unknown, optional)
- presented_anchor (unknown, optional)
- presented_timestamp (unknown, optional)

## Outputs

- algo_match (boolean, optional)
- hash_match (boolean, optional)
- ts_consistent (boolean, optional)
- verified (boolean, optional)

## Sample

```json
{
  "document_hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "presented_anchor": {
    "document_hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "timestamp_claim": {
      "standard": "eIDAS Art.41 / RFC 3161-aligned",
      "timestamp": "2026-06-25T10:00:00Z",
      "algorithm": "sha256"
    }
  },
  "presented_timestamp": "2026-06-25T10:00:00Z",
  "expected_algorithm": "sha256"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_timestamp_attestation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Document Integrity & eIDAS Electronic Timestamp Anchor

Bind a document SHA-256 and claimed timestamp into an OCG execution_hash that serves as an eIDAS Art.41 / RFC 3161-aligned electronic timestamp: self-verifiable, no external TSA call. Optional C2PA manifest field. Feeds timestamp attestation verifier (art-122).

- Page: https://ainumbers.co/chaingraph/art-121-document-integrity-anchor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-121-document-integrity-anchor.md
- MCP tool: anchor_document_integrity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- claimed_timestamp (unknown, optional)
- document_hash (unknown, optional)
- document_type (unknown, optional)
- hash_algorithm (unknown, optional)

## Outputs

- anchored (boolean, optional)
- document_hash (string, optional)
- document_type (string, optional)
- timestamp_claim (object, optional)

## Sample

```json
{
  "document_hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "claimed_timestamp": "2026-06-25T10:00:00Z",
  "hash_algorithm": "sha256",
  "document_type": "contract"
}
```

## Verify

Run the sample policy_parameters through MCP tool `anchor_document_integrity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

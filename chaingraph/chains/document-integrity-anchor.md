# Document Integrity & Timestamp Anchor (eIDAS Art.41 / RFC 3161)

Anchor document SHA-256 + claimed timestamp as an eIDAS Art.41-aligned electronic timestamp (art-121) → verify that the anchor recomputes correctly and all claims are internally consistent (art-122). W3C VC export via §13.11.

- Page: https://ainumbers.co/chaingraph/chains/document-integrity-anchor.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/document-integrity-anchor.md

## Workflow chain: Document Integrity & Timestamp Anchor (eIDAS Art.41 / RFC 3161)

Anchor document SHA-256 + claimed timestamp as an eIDAS Art.41-aligned electronic timestamp (art-121) → verify that the anchor recomputes correctly and all claims are internally consistent (art-122). W3C VC export via §13.11.

Domain: Document & Content Provenance

### Steps

1. art-121-document-integrity-anchor
   document hash + timestamp anchor feeds attestation verification
2. art-122-timestamp-attestation-verifier
   Exports verified timestamp artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Document Conversion Verification

Convert a document locally, bind the conversion into a receipt, and independently verify the receipt. Stage 1 converts Markdown to HTML and plain text (art-189), or tabular data across CSV, JSON, and Markdown tables on the tabular branch (art-190). Stage 2 binds the input digest, converter identity, parameters, and output digest into a canonical receipt (art-191). Stage 3 recomputes the binding and re-hashes the files to return a valid, binding_mismatch, digest_mismatch, or malformed verdict (art-192). Every stage produces a SHA-256 execution hash. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/chains/document-conversion-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/document-conversion-verification.md

## Workflow chain: Document Conversion Verification

Convert a document locally, bind the conversion into a receipt, and independently verify the receipt. Stage 1 converts Markdown to HTML and plain text (art-189), or tabular data across CSV, JSON, and Markdown tables on the tabular branch (art-190). Stage 2 binds the input digest, converter identity, parameters, and output digest into a canonical receipt (art-191). Stage 3 recomputes the binding and re-hashes the files to return a valid, binding_mismatch, digest_mismatch, or malformed verdict (art-192). Every stage produces a SHA-256 execution hash. Zero network, zero PII.

Domain: Document & Content Provenance

### Steps

1. art-189-markdown-document-converter
   Local conversion produces input and output digests that feed the receipt builder (tabular branch swaps in art-190)
2. art-191-conversion-receipt-builder
   Binds the conversion edge into a receipt with binding_sha256 that feeds the verifier
3. art-192-conversion-receipt-verifier
   Recomputes the binding and returns the verification verdict with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

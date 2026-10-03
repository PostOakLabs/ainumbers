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

### Ask your agent

Question: Legal sent a markdown memo for publication as HTML. How many words does the conversion count, and does any later edit change the digest?
Run the AINumbers MCP tool `run_chain` with {"chain":"document-conversion-verification"} and read `art-189-markdown-document-converter.stats.words`.
Re-run with `inputs` for `art-189-markdown-document-converter`, reusing the values that result echoed, with `markdown` set to "# Memo\n\nOne short paragraph.". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/document-conversion-verification.html

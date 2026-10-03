# Document Sanitization Integrity

Strip file metadata locally, prove what was removed, bind the sanitization into a receipt, and record the cleaned files in a digest manifest. Stage 1 produces a proof-of-sanitization record binding the original digest to the removed, redacted, or retained findings and the sanitized digest, with a residual-risk analysis by file type (art-193). Stage 2 binds the sanitization edge into a canonical conversion receipt (art-191). Stage 3 records the original and cleaned file digests in one canonical, hash-anchored manifest (art-194). Every stage produces a SHA-256 execution hash. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/chains/document-sanitization-integrity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/document-sanitization-integrity.md

## Workflow chain: Document Sanitization Integrity

Strip file metadata locally, prove what was removed, bind the sanitization into a receipt, and record the cleaned files in a digest manifest. Stage 1 produces a proof-of-sanitization record binding the original digest to the removed, redacted, or retained findings and the sanitized digest, with a residual-risk analysis by file type (art-193). Stage 2 binds the sanitization edge into a canonical conversion receipt (art-191). Stage 3 records the original and cleaned file digests in one canonical, hash-anchored manifest (art-194). Every stage produces a SHA-256 execution hash. Zero network, zero PII.

Domain: Document & Content Provenance

### Steps

1. art-193-metadata-sanitization-prover
   Sanitization record digests feed the receipt builder
2. art-191-conversion-receipt-builder
   Binds the sanitization edge into a receipt that feeds the manifest builder
3. art-194-digest-manifest-builder
   Records original and cleaned file digests in one hash-anchored manifest with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A photo for the press office had its location metadata stripped. Does the sanitization proof stand up for this file type?
Run the AINumbers MCP tool `run_chain` with {"chain":"document-sanitization-integrity"} and read `art-193-metadata-sanitization-prover.verdict`.
Re-run with `inputs` for `art-193-metadata-sanitization-prover`, reusing the values that result echoed, with `file_type` set to "pdf". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/document-sanitization-integrity.html

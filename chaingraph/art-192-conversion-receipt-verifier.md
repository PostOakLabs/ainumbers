# Conversion Receipt Verifier

Re-verifies a conversion receipt from art-191: recomputes binding_sha256 over the JCS-canonical receipt and compares, checks structure and hex fields, and optionally compares digests re-hashed from the actual files. Returns a verdict of valid, binding_mismatch, digest_mismatch, or malformed, plus a per-check detail list. This verifies the domain receipt inside the artifact, which is distinct from verify_execution_hash, the utility that verifies the section 4 artifact envelope. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-192-conversion-receipt-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-192-conversion-receipt-verifier.md
- MCP tool: verify_conversion_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- receipt (unknown, optional)
- recomputed_input_sha256 (unknown, optional)
- recomputed_output_sha256 (unknown, optional)

## Outputs

- binding_ok (boolean, optional)
- checks (array, optional)
- digest_ok (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "receipt": {
    "receipt_version": "1.0",
    "input": {
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "format": "markdown"
    },
    "output": {
      "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "format": "html"
    },
    "converter": {
      "name": "art-189-markdown-document-converter",
      "version": "1.0.0"
    },
    "parameters": {
      "heading_ids": true,
      "table_support": true
    },
    "binding_sha256": "7c0e135c7d670decbdea449f9dc580b75cc01ef50eb4bb3f5d3540050b6a30e7"
  },
  "recomputed_input_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "recomputed_output_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_conversion_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

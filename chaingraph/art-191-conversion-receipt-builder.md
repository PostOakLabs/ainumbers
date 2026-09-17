# Conversion Receipt Builder

Binds one file-conversion event into a canonical receipt tying the input digest to the converter identity, the parameters, and the output digest. binding_sha256 is SHA-256 over the JCS-canonical receipt with binding_sha256 removed. Any external converter, including the heavy WASM Conversion Lab tools, can feed it digests, and it is the documented hand-off point for BrowserChain anchoring. This binds a transformation edge between two digests, which is a different job from anchor_document_integrity (art-121, existence and timestamp of one document). Returns the receipt plus checks for hex validity, converter identity completeness, and self-conversion. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-191-conversion-receipt-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-191-conversion-receipt-builder.md
- MCP tool: build_conversion_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- converter (unknown, required)
- input_filename (unknown, optional)
- input_sha256 (unknown, optional)
- output_filename (unknown, optional)
- output_sha256 (unknown, optional)
- parameters (array, required)
- source_format (unknown, optional)
- target_format (unknown, optional)

## Outputs

- all_checks_pass (boolean, optional)
- checks (array, optional)
- receipt (object, optional)

## Sample

```json
{
  "input_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "output_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "source_format": "markdown",
  "target_format": "html",
  "converter": {
    "name": "art-189-markdown-document-converter",
    "version": "1.0.0"
  },
  "parameters": {
    "heading_ids": true,
    "table_support": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_conversion_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

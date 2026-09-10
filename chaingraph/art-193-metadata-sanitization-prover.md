# Metadata Sanitization Prover

Produces a proof-of-sanitization record binding the original digest to the findings removed, redacted, or retained and to the sanitized digest, with a deterministic residual-risk analysis by file type (JPEG COM segments, PNG textual chunks, PDF and DOCX XMP and embedded-object metadata). The kernel receives field names and categories only, never metadata values, because those values can themselves be PII such as GPS coordinates and author names. Returns the sanitization record, residual_risks, and a verdict of sanitized, partially_sanitized, or not_verifiable. Feeds the conversion receipt builder. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-193-metadata-sanitization-prover.html
- Markdown twin: https://ainumbers.co/chaingraph/art-193-metadata-sanitization-prover.md
- MCP tool: prove_metadata_sanitization (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bytes_after (unknown, optional)
- bytes_before (unknown, optional)
- file_type (unknown, optional)
- findings (array, optional)
- original_sha256 (unknown, optional)
- sanitized_sha256 (unknown, optional)

## Outputs

- residual_risks (array, optional)
- sanitization_record (object, optional)
- verdict (string, optional)

## Sample

```json
{
  "original_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sanitized_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "file_type": "jpeg",
  "findings": [
    {
      "field": "GPSLatitude",
      "category": "gps",
      "action": "removed"
    },
    {
      "field": "GPSLongitude",
      "category": "gps",
      "action": "removed"
    },
    {
      "field": "Make",
      "category": "device",
      "action": "removed"
    },
    {
      "field": "UserComment",
      "category": "comment",
      "action": "removed"
    }
  ],
  "bytes_before": 204800,
  "bytes_after": 203100
}
```

## Verify

Run the sample policy_parameters through MCP tool `prove_metadata_sanitization` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Tabular Data Converter

Deterministic conversion across CSV, JSON (array of objects), and GFM pipe tables with RFC 4180 CSV parsing (quoted fields, embedded delimiters and newlines, escaped quotes). JSON key order follows header order. Numbers stay strings unless coerce_types is set, and then only strings matching a strict finite-decimal pattern are coerced, so non-finite values can never be produced. Ragged rows, duplicate headers, and coercions are surfaced in warnings, never silently dropped. Returns converted text, row_count, column_count, columns, warnings, and input and output SHA-256 digests. Feeds the conversion receipt builder. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-190-tabular-data-converter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-190-tabular-data-converter.md
- MCP tool: convert_tabular_data (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- data (unknown, optional)
- options (unknown, required)
- source_format (unknown, optional)
- target_format (unknown, optional)

## Outputs

- column_count (integer, optional)
- columns (array, optional)
- converted (string, optional)
- error (string, optional)
- input_sha256 (string, optional)
- output_sha256 (string, optional)
- row_count (integer, optional)
- source_format (string, optional)
- target_format (string, optional)
- warnings (array, optional)

## Sample

```json
{
  "data": "name,qty\napple,3\npear,5",
  "source_format": "csv",
  "target_format": "json",
  "options": {
    "has_header": true,
    "coerce_types": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `convert_tabular_data` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

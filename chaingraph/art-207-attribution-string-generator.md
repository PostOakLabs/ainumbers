# Attribution String Generator

Generates a human-readable TASL (Title/Author/Source/License) attribution line plus machine-readable ccREL JSON-LD and RDFa blocks for any Creative Commons licensed work. Source of truth: Creative Commons Rights Expression Language (ccREL) specification. Not legal advice. Selection and formatting aid only.

- Page: https://ainumbers.co/chaingraph/art-207-attribution-string-generator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-207-attribution-string-generator.md
- MCP tool: generate_attribution_string (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- creator (unknown, required)
- license (unknown, required)
- source_url (unknown, required)
- title (unknown, required)
- work_url (unknown, required)

## Outputs

- disclaimer (string, required)
- errors (array, required)
- json_ld (object,null, required)
- license_name (string, optional)
- license_spdx (string, optional)
- license_url (string, optional)
- rdfa_html (string, required)
- tasl_line (string, required)
- valid (boolean, required)

## Sample

```json
{
  "title": "My Photograph",
  "creator": "Jane Smith",
  "source_url": "https://example.com/photo",
  "license": "CC-BY-4.0"
}
```

## Verify

Run the sample policy_parameters through MCP tool `generate_attribution_string` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

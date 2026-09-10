# Markdown Document Converter

Deterministic Markdown to HTML and plain text over a hand-rolled CommonMark subset (headings, bold/italic/code spans, fenced code, blockquotes, one-level lists, links, images as links, horizontal rules, GFM pipe tables). All raw HTML in the input is escaped, so the output is injection-safe. Returns html, plain_text, stats (headings, links, code_blocks, tables, words), and SHA-256 digests of the input, HTML, and plain text computed over exact UTF-8 bytes with no normalization. Feeds the conversion receipt builder. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-189-markdown-document-converter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-189-markdown-document-converter.md
- MCP tool: convert_markdown_document (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- markdown (unknown, optional)
- options (unknown, required)

## Outputs

- digest_basis (string, optional)
- html (string, optional)
- html_sha256 (string, optional)
- input_sha256 (string, optional)
- plain_text (string, optional)
- plain_text_sha256 (string, optional)
- stats (object, optional)

## Sample

```json
{
  "markdown": "# Title\n\nHello **world**, see [docs](https://ainumbers.co).\n\n- one\n- two\n\n| Col A | Col B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n",
  "options": {
    "heading_ids": true,
    "table_support": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `convert_markdown_document` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

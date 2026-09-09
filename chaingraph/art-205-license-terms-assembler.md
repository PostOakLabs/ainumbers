# License Terms Assembler

Renders a deterministic license term sheet by substituting field values into a pre-approved template (CC-STANDARD-USE, IP3-RIGHTS-RECORD, NFT-EMBEDDED-LICENSE). No bespoke legal drafting. Outputs rendered plain text and HTML. Not legal advice. Substitution into fixed templates only.

- Page: https://ainumbers.co/chaingraph/art-205-license-terms-assembler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-205-license-terms-assembler.md
- MCP tool: assemble_license_terms (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fields (array, required)
- template_id (string, required)

## Outputs

- available_templates (array, optional)
- checks (array, optional)
- disclaimer (string, optional)
- fields_missing (array, optional)
- fields_used (object, optional)
- rendered_html (string, optional)
- rendered_text (string, optional)
- template_id (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assemble_license_terms` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Rights Record Builder

Builds a normalized IP3-style rights-portfolio row from licensor, licensee, territory, term, rights vector, and renewal fields. Computes a deterministic record_hash via SHA-256 over the JCS-canonical rights row. Not legal advice. Documentation of stated parameters only.

- Page: https://ainumbers.co/chaingraph/art-206-rights-record-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-206-rights-record-builder.md
- MCP tool: build_rights_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_ref (unknown, required)
- license_id (unknown, required)
- licensee (unknown, required)
- licensor (unknown, required)
- renewal (string, required)
- rights_vector (array, required)
- term_years (unknown, required)
- territory (unknown, required)

## Outputs

- all_checks_pass (boolean, optional)
- checks (array, optional)
- disclaimer (string, optional)
- record_hash (string, optional)
- rights_row (object, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `build_rights_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Cross-License Rights Comparator

Compares any two licenses from the CC, CBE, and PIL families on a 9-dimension rights vector (copy, display, commercial, exclusive, modify, sublicense, share_alike, attribution, revocable). Returns a diff array and a partial-order permissiveness result: a_more_permissive, b_more_permissive, equal, or incomparable. Informational Rosetta stone for cross-framework license selection. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-198-cross-license-rights-comparator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-198-cross-license-rights-comparator.md
- MCP tool: compare_rights_matrix (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- license_ref_a (unknown, required)
- license_ref_b (unknown, required)

## Outputs

- checks (array, optional)
- diff (array, optional)
- dimensions (array, optional)
- disclaimer (string, optional)
- matrix_note (string, optional)
- more_permissive_than (string, optional)
- ref_a (object, optional)
- ref_b (object, optional)
- sources (object, optional)
- vector_a (object, optional)
- vector_b (object, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_rights_matrix` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

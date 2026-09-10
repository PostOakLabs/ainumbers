# Provenance Ingredient Tree Resolver

Walk the c2pa.ingredient parent-of tree; confirm each ingredient hashed_uri binding and nested manifest hash chains back to the active manifest; flag broken provenance edges and redacted-but-referenced ingredients. Emits tree depth and intact/broken verdict.

- Page: https://ainumbers.co/chaingraph/art-125-provenance-ingredient-tree-resolver.html
- Markdown twin: https://ainumbers.co/chaingraph/art-125-provenance-ingredient-tree-resolver.md
- MCP tool: resolve_provenance_ingredient_tree (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "active_manifest_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "ingredients": [
    {
      "label": "c2pa.ingredient",
      "hashed_uri": "self#jumbf=/c2pa/urn:uuid:abc",
      "nested_manifest_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "relationship": "parentOf",
      "redacted": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `resolve_provenance_ingredient_tree` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# No-Russia-Clause Pack Builder

Generates the contractual no-Russia clause + DD-evidence checklist conformance artifact for the EU 20th-package seller-liability-shift safe harbour (Art. 12g). Standard and enhanced templates. Decision-support draft only.

- Page: https://ainumbers.co/chaingraph/art-96-no-russia-clause-pack-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-96-no-russia-clause-pack-builder.md
- MCP tool: build_no_russia_clause_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- contract (unknown, optional)

## Outputs

- clause_text (string, optional)
- completeness_grade (string, optional)
- eu_20th_note (string, optional)
- evidence_checklist (array, optional)
- missing_required_items (array, optional)
- note (string, optional)
- reference_version (string, optional)
- required_items_met (integer, optional)
- required_items_total (integer, optional)
- template_used (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `build_no_russia_clause_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

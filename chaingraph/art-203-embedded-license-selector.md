# Embedded License Selector

Maps creator answers to the SolSea and ALL.ART 4-tier embedded-license menu: Private/No Commercial, Personal/Public Display/No Commercial, Public Display/No Commercial, or Reproduction/Commercial. Outputs the elected tier id, label, rights vector, decision path, and source citation. Not legal advice. Selection only.

- Page: https://ainumbers.co/chaingraph/art-203-embedded-license-selector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-203-embedded-license-selector.md
- MCP tool: select_embedded_license (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allow_sharing (unknown, required)
- commercial_use (unknown, required)
- public_display (unknown, required)

## Outputs

- decision_path (array, optional)
- description (string, optional)
- disclaimer (string, optional)
- inputs_resolved (object, optional)
- label (string, optional)
- rights (object, optional)
- source_family (string, optional)
- source_url (string, optional)
- tier_id (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `select_embedded_license` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

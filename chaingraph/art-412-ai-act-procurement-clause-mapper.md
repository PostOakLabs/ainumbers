# AI Act Procurement Clause Mapper

Maps an EU AI Act risk tier (derived from an upstream classifier such as the AI Act high-risk fit diagnostic) to the European Commission's Model Contractual AI Clauses (MCC-AI) template selection: High-Risk or Light, plus the applicable Chapter III clause set (transparency, risk management, data governance, human oversight, cybersecurity for High-Risk; a reduced set for Light). Reference mode only: MCC-AI redistribution terms are unclear, so this node selects and points to the official source rather than vendoring clause text. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-412-ai-act-procurement-clause-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-412-ai-act-procurement-clause-mapper.md
- MCP tool: map_ai_act_procurement_clauses (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- deployment_context (unknown, required)
- risk_tier (unknown, required)

## Outputs

- applicable_chapter_iii_clauses (array, optional)
- checks (array, optional)
- disclaimer (string, optional)
- license_mode (string, optional)
- not_legal_advice (boolean, optional)
- official_source_url (string, optional)
- risk_tier (string, optional)
- template (string, optional)
- variable_map (object, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `map_ai_act_procurement_clauses` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

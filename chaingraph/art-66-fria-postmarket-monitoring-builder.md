# FRIA & Post-Market Monitoring Plan Builder

Builds an Art 27 Fundamental Rights Impact Assessment (FRIA) + Art 72 post-market monitoring plan + Art 12 logging + Art 14 human-oversight design + Art 73 serious-incident reporting path for a bank or insurer deploying a high-risk AI system. Prepare-ahead: 2 Dec 2027 (verify Digital Omnibus). Decision-support draft.

- Page: https://ainumbers.co/chaingraph/art-66-fria-postmarket-monitoring-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-66-fria-postmarket-monitoring-builder.md
- MCP tool: build_fria_monitoring_plan (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- deployment (unknown, optional)
- fria (unknown, optional)
- human_oversight (unknown, optional)
- incident_reporting (unknown, optional)
- logging (unknown, optional)
- monitoring_plan (unknown, optional)

## Outputs

- affected_rights (array, optional)
- applicable_date_note (string, optional)
- deployment (object, optional)
- fria_gaps (array, optional)
- fria_grade (string, optional)
- fria_score (integer, optional)
- incident_path (object, optional)
- logging_verdict (string, optional)
- monitoring_plan_skeleton (object, optional)
- note (string, optional)
- overall_score (number, optional)
- oversight_verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `build_fria_monitoring_plan` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

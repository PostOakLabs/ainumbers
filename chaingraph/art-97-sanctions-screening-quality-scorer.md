# Sanctions Screening-Program Quality Scorer

Wolfsberg-aligned screening-program quality scorecard: list coverage + match calibration + alert tuning + escalation workflow + model validation -> composite program-conformance grade and improvement priorities.

- Page: https://ainumbers.co/chaingraph/art-97-sanctions-screening-quality-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-97-sanctions-screening-quality-scorer.md
- MCP tool: score_sanctions_screening_quality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- component_scores (object, optional)
- component_weights (object, optional)
- composite_pct (integer, optional)
- improvement_priorities (array, optional)
- note (string, optional)
- program_grade (string, optional)
- reference_version (string, optional)
- wolfsberg_note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `score_sanctions_screening_quality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

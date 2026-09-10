# EU Taxonomy Alignment Scorer

Scores an economic activity against an environmental objective: substantial-contribution technical-screening criteria + DNSH across the other five objectives + minimum safeguards -> aligned / eligible-but-not-aligned / not-eligible. Taxonomy Omnibus I revisions in force 28 Jan 2026.

- Page: https://ainumbers.co/chaingraph/art-73-taxonomy-alignment-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-73-taxonomy-alignment-scorer.md
- MCP tool: score_taxonomy_alignment (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- activity (unknown, optional)
- criterion_refs (unknown, optional)
- dnsh (unknown, optional)
- minimum_safeguards (unknown, optional)
- substantial_contribution (unknown, optional)

## Outputs

- alignment_verdict (string, optional)
- criterion_refs (array, optional)
- dnsh_gaps (array, optional)
- dnsh_results (object, optional)
- is_aligned (boolean, optional)
- nace_code (string, optional)
- note (string, optional)
- primary_objective (string, optional)
- reference (object, optional)
- safeguards_status (string, optional)
- substantial_contribution_status (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `score_taxonomy_alignment` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

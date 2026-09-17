# EU AI Act Credit-Scoring Conformity Pack

Bias testing across protected characteristics (disparate impact ratios, equalized odds gaps), data-quality attestations, Article 11 technical-documentation skeleton, conformity self-assessment. Hard deadline 2 December 2027, per the Digital Omnibus amendments (June 2026).

- Page: https://ainumbers.co/chaingraph/art-05-eu-ai-act-credit-scoring-conformity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-05-eu-ai-act-credit-scoring-conformity.md
- MCP tool: assess_ai_act_conformity (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_ai_act_conformity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Agentic AI Risk & GPAI Governance Classifier

Co-flagship and strongest in-force anchor: classifies autonomy tier and GPAI/systemic-risk obligations (Arts 53-55, IN FORCE since 2 Aug 2025, explicitly unchanged by the Digital Omnibus) for agentic and foundation-model AI in financial services. Maps Art 50 transparency, Art 4 AI literacy (IN FORCE Feb 2025), Art 14 HNP oversight, systemic-risk 10^25 FLOP threshold, and downstream Annex III high-risk interaction.

- Page: https://ainumbers.co/chaingraph/art-67-agentic-ai-risk-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-67-agentic-ai-risk-classifier.md
- MCP tool: classify_agentic_ai_risk (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent (unknown, optional)
- downstream_highrisk (unknown, optional)
- model (unknown, optional)
- obligations (unknown, optional)

## Outputs

- applicable_obligations (array, optional)
- autonomy_oversight_verdict (string, optional)
- dim_scores (object, optional)
- governance_tier (string, optional)
- gpai_class (string, optional)
- highrisk_interaction (string, optional)
- in_force_status (string, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (number, optional)
- recommendation (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_agentic_ai_risk` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

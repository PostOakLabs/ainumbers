# AMLA Transaction-Typology Risk Scorer

Scores a synthetic transaction graph against AML typologies and FATF Travel Rule predicates; exports an AML risk determination per account/cluster. Chains into CRY-01 for ZK proof of the same predicate: a uniquely coherent two-tool story.

- Page: https://ainumbers.co/chaingraph/art-10-amla-transaction-typology-risk-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-10-amla-transaction-typology-risk-scorer.md
- MCP tool: score_aml_typologies (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- round_trip_window_hours (unknown, optional)
- scenario (unknown, optional)
- structuring_threshold (unknown, optional)
- transactions (unknown, required)
- velocity_window_hours (unknown, optional)

## Outputs

- average_score (number, optional)
- compliance_flags (array, optional)
- high_risk_count (integer, optional)
- max_score (number, optional)
- medium_risk_count (integer, optional)
- overall_risk (string, optional)
- top_risk_accounts (array, optional)
- transaction_count (integer, optional)
- travel_rule_violations (integer, optional)
- typology_hit_counts (object, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `score_aml_typologies` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

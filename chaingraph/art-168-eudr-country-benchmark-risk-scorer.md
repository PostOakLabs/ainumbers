# EUDR Country Benchmark Risk Scorer

Score country-of-production against the EUDR benchmark risk classification (low/standard/high per Art. 29): low risk (EU/EEA + strong forest governance) -> 1% inspection rate, simplified due diligence; standard risk (unclassified) -> 3% inspection rate, full due diligence; high risk -> 9% inspection rate, enhanced due diligence. Returns benchmark_risk, inspection_rate_pct, and due_diligence_level. Feeds traceability linker (art-169). Zero network, zero PII. Reg. EU 2023/1115.

- Page: https://ainumbers.co/chaingraph/art-168-eudr-country-benchmark-risk-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-168-eudr-country-benchmark-risk-scorer.md
- MCP tool: score_eudr_country_risk (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- country_code (unknown, optional)

## Outputs

- benchmark_risk (string, optional)
- commission_delegated_act_note (string, optional)
- country_code (string, optional)
- due_diligence_level (string, optional)
- inspection_rate_pct (integer, optional)

## Sample

```json
{
  "country_code": "DE"
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_eudr_country_risk` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

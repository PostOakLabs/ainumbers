# Settlement Efficiency KPI Engine

Aggregates batch settlement data into CSDR/T+1-relevant KPIs: settlement rate, fail rate, total CSDR penalty cost, on-time allocation rate, SSI golden-source coverage, buy-in triggered count, and fail-duration distribution. Benchmarks against ESMA annual settlement-efficiency statistics (~97.5% EU average).

- Page: https://ainumbers.co/chaingraph/art-84-settlement-efficiency-kpi.html
- Markdown twin: https://ainumbers.co/chaingraph/art-84-settlement-efficiency-kpi.md
- MCP tool: compute_settlement_efficiency_kpi (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- instructions (unknown, optional)
- period_label (unknown, optional)

## Outputs

- benchmark (object, optional)
- buyin_triggered_count (integer, optional)
- fail_duration_distribution (object, optional)
- fail_rate (integer, optional)
- note (string, optional)
- on_time_allocation_rate (integer, optional)
- period_label (string, optional)
- settlement_grade (string, optional)
- settlement_rate (integer, optional)
- ssi_golden_coverage_pct (integer, optional)
- total_instructions (integer, optional)
- total_penalty_cost (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_settlement_efficiency_kpi` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

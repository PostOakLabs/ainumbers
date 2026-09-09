# Corridor Cost Comparator (World Bank RPW)

Benchmarks a remittance corridor total cost (fee % + FX margin %) against the World Bank Remittance Prices Worldwide (RPW) Q1 2026 snapshot for the same origin-destination pair, the SmaRT global average (6.36%), and the SDG 10.c 3% target. Reports meets_sdg_target, vs_rpw_benchmark, cost_at_200_usd, and cost_at_500_usd. For stablecoin corridor all-in economics use model_stablecoin_corridor_economics (art-250). For Reg E disclosure arithmetic use compute_remittance_disclosure (art-248). ZERO PII: corridor codes, amounts, and rates only.

- Page: https://ainumbers.co/chaingraph/art-249-compare-corridor-cost.html
- Markdown twin: https://ainumbers.co/chaingraph/art-249-compare-corridor-cost.md
- MCP tool: compare_corridor_cost (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- from_country (string, required)
- fx_rate_mid (unknown, required)
- fx_rate_used (unknown, required)
- provider_fee (unknown, required)
- send_amount (unknown, required)
- service_name (unknown, required)
- to_country (string, required)

## Outputs

- corridor (string, optional)
- cost_at_200_usd (number, optional)
- cost_at_500_usd (number, optional)
- disambiguation (string, optional)
- fee_pct (integer, optional)
- from_country (string, optional)
- fx_margin_pct (number, optional)
- meets_sdg_target (boolean, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- rpw_benchmark_pct (number, optional)
- rpw_corridor_avg_200 (number, optional)
- rpw_corridor_avg_500 (number, optional)
- rpw_service_count (integer, optional)
- sdg_target_pct (integer, optional)
- send_amount (integer, optional)
- service_name (string, optional)
- smart_global_avg_pct (number, optional)
- table_source (string, optional)
- table_version (string, optional)
- to_country (string, optional)
- total_cost_pct (number, optional)
- vs_rpw_benchmark (number, optional)
- vs_sdg_target (number, optional)
- vs_smart_avg (number, optional)

## Sample

```json
{
  "from_country": "US",
  "to_country": "MX",
  "send_amount": 200,
  "provider_fee": 4,
  "fx_rate_used": 17.03,
  "fx_rate_mid": 17.2,
  "service_name": "SDG-3pct-exact"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_corridor_cost` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

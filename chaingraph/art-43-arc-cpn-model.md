# Arc CPN Corridor Economics Model

Model CPN corridor economics vs SWIFT/ACH/SEPA/card/RTP for cross-border USD flows. Quantifies per-payment cost, FX spread, settlement time, and 3-year NPV. Industry benchmarks: WorldBank Q4 2024 (SWIFT 5.5% remittance), Nacha 2024 (ACH). CPN fee $0.01 user-adjustable estimate.

- Page: https://ainumbers.co/chaingraph/art-43-arc-cpn-model.html
- Markdown twin: https://ainumbers.co/chaingraph/art-43-arc-cpn-model.md
- MCP tool: model_arc_cpn_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cpn_fee_usd (unknown, optional): Amount in US dollars
- fx_spread_bps (unknown, optional): Amount in basis points
- impl_months (unknown, optional)
- monthly_volume (unknown, optional)
- notional_usd (unknown, optional): Amount in US dollars
- rail (unknown, optional)

## Outputs

- verdict (string, optional)
- rail (string, optional)
- compliance_flags (array, optional)

## Sample

```json
{
  "rail": "swift",
  "notional_usd": 10000,
  "monthly_volume": 200,
  "impl_months": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_arc_cpn_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

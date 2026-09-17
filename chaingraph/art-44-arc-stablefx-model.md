# Arc StableFX RFQ Economics Model

Quantify Herstatt risk elimination and FX spread savings from Arc StableFX 24/7 atomic PvP settlement vs non-CLS bilateral FX. Methodology: BIS (Allsopp et al. 1996) Herstatt credit cost proxy via counterparty spread. PFMI P12 atomic settlement; BIS FX Global Code P35 netting.

- Page: https://ainumbers.co/chaingraph/art-44-arc-stablefx-model.html
- Markdown twin: https://ainumbers.co/chaingraph/art-44-arc-stablefx-model.md
- MCP tool: model_arc_stablefx_rfq (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cls_annual_fee_usd (unknown, optional): Amount in US dollars
- daily_fx_volume_usd (unknown, optional): Amount in US dollars
- herstatt_spread_bps (unknown, optional): Amount in basis points
- impl_months (unknown, optional)
- non_cls_bilateral_bps (unknown, optional): Amount in basis points
- stablefx_fee_bps (unknown, optional): Amount in basis points
- trading_days (unknown, optional): Duration in days

## Outputs

- verdict (string, optional)
- compliance_flags (array, optional)

## Sample

```json
{
  "daily_fx_volume_usd": 5000000,
  "herstatt_spread_bps": 2.5,
  "non_cls_bilateral_bps": 8,
  "cls_annual_fee_usd": 100000,
  "stablefx_fee_bps": 1.5,
  "trading_days": 250,
  "impl_months": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_arc_stablefx_rfq` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

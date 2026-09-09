# LTC Funding Comparator

Computes the arithmetic of a declared long-term-care funding comparison over a declared horizon: simple sums of the declared self-fund annual set-aside and the declared traditional annual premium across the declared horizon years, alongside the declared hybrid lump premium, naming the option with the unique smallest total (CHEAPEST_IDENTIFIED) or reporting a tie with no unique cheapest (TIE_IDENTIFIED), with a full trace. Every input is a caller-declared synthetic value; no policy record, health datum, market feed, or clock is read. Rounding is 2dp half-up, declared in-kernel. Discounting at a declared rate and a sensitivity note are out of scope for v1. The kernel never recommends that a caller buy, avoid, or replace any long-term-care funding instrument; it is arithmetic over declarations, not advice.

- Page: https://ainumbers.co/tools/686-ltc-funding-comparator.html
- Markdown twin: https://ainumbers.co/tools/686-ltc-funding-comparator.md
- MCP tool: compute_ltc_funding_comparator (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "horizon_years": 25,
  "self_fund_annual": 4800,
  "hybrid_premium_total": 110000,
  "traditional_annual": 3200
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_ltc_funding_comparator` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

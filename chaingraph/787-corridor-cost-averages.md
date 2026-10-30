# Corridor Cost Averages

Computes one remittance corridor's cost THREE ways from caller-declared provider quotes and reports each against the SDG 10.c 3% target and the G20 no-corridor-above-5% per-corridor target for 2030. simple = simple average of all quoted total costs (UN SDG indicator 10.c.1 metadata, section 4.c); lowest_n = average of the n cheapest quotes, default n=3 = the SmaRT average defined by the same metadata section; weighted = market-share-weighted average, an analyst convention motivated by the World Bank RPW survey frame (>=80% market-share coverage), reported null with a reason code when shares are missing or do not sum to 100 within tolerance - never silently renormalised. Cost per quote = transfer fee + FX margin as a percentage of the send amount (World Bank RPW methodology; reference amounts 200 and 500, default 200). Integer basis-point arithmetic internally, half-up rounding applied once per figure. Quotes carry pseudonymous provider codes only: no real provider names, no live data, no PII. Malformed quotes refuse the whole call. The simple average output can feed compare_corridor_cost (art-249) as the declared corridor cost.

- Page: https://ainumbers.co/chaingraph/787-corridor-cost-averages.html
- Markdown twin: https://ainumbers.co/chaingraph/787-corridor-cost-averages.md
- MCP tool: compute_corridor_cost_averages (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- corridor (object, required): The remittance corridor.
- send_amount (number, optional): Optional send amount in the send currency. Defaults to 200, the RPW reference amount; 500 is the second RPW reference amount.
- quotes (array, required): Declared provider quotes. Synthetic, pseudonymous inputs only.
- lowest_n (integer, optional): Optional number of cheapest quotes for the lowest_n average. Default 3, the SmaRT rule.
- targets (object, optional): Optional target overrides in percent. Defaults 3 and 5.

## Outputs

- verdict (string, optional)
- corridor (string, optional)
- send_amount (number, optional)
- lowest_n (integer, optional)
- quotes_count (integer, optional)
- averages (object, optional)
- weighted_null_reason (string,null, optional)
- spread_pp (number,null, optional)
- weighting_coverage_pct (number,null, optional)
- targets (object, optional)
- method_notes (array, optional)
- pii_note (string, optional)
- adjacency_note (string, optional)

## Sample

```json
{
  "corridor": {
    "origin": "AU",
    "destination": "TO"
  },
  "send_amount": 200,
  "quotes": [
    {
      "provider_code": "PSP-A1",
      "fee": 4,
      "fx_margin_pct": 1.6,
      "market_share_pct": 35
    },
    {
      "provider_code": "PSP-A2",
      "fee": 5,
      "fx_margin_pct": 2,
      "market_share_pct": 25
    },
    {
      "provider_code": "PSP-A3",
      "fee": 2,
      "fx_margin_pct": 0.6,
      "market_share_pct": 15
    },
    {
      "provider_code": "PSP-A4",
      "fee": 3,
      "fx_margin_pct": 1,
      "market_share_pct": 15
    },
    {
      "provider_code": "PSP-A5",
      "fee": 6,
      "fx_margin_pct": 2,
      "market_share_pct": 10
    },
    {
      "provider_code": "PSP-A6",
      "fee": 2.4,
      "fx_margin_pct": 0.8,
      "market_share_pct": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_corridor_cost_averages` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

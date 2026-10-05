# AI Token Spend

Monthly AI token spend estimator and cross-model comparator. The caller supplies an as_of date (the node never reads a clock), a usage profile (requests per month, input tokens per request, a cached-input share in basis points, cache-write tokens with a 5-minute or 1-hour TTL, output tokens per request, a batch share and a long-context share), a dated price_table whose entries carry tier, effective_from/effective_through bounds and integer USD micros per million tokens, and the model names to compare. A price entry applies at as_of when effective_from <= as_of <= effective_through; two applicable entries for a compared model are an AMBIGUOUS_PRICE refusal, never a silent pick, and none is NO_PRICE_FOR_DATE. Each component's tokens are split into disjoint plain, batch and long-context slices priced from the matching block; a slice needing a combined batch+long-context block the entry does not list is NO_PRICE_FOR_COMBINATION, and a missing component price is a refusal naming the model and the component. The cost of T tokens at price P is floor(T/1e6)*P + floor((T mod 1e6)*P/1e6), overflow-safe for the validated caps (monthly tokens per component at most 1e12, refused above; prices at most 1e9). Output carries per-model monthly and per-request cost in integer micros, the four-component breakdown, a cheapest-first ranking with ties broken by the model string, per-model refusals, the snapshot age in days, and a scope note: no taxes or regional uplift, no image, audio or video tokens, no tool-use surcharges, no tiered volume discounts, and no subscription or committed-spend deals. Prices are an input, never kernel constants: the default snapshot is a dated capture of the official provider price pages, inlined in the page and manifest, and refreshing it never changes kernel bytes.

- Page: https://ainumbers.co/chaingraph/art-704-ai-token-spend.html
- Markdown twin: https://ainumbers.co/chaingraph/art-704-ai-token-spend.md
- MCP tool: estimate_ai_token_spend (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, required): Pricing date, a real calendar date as YYYY-MM-DD. The node reads no clock; an entry applies when effective_from <= as_of <= effective_through.
- usage (object, required): Requests per month, input and output tokens per request, cached-input and batch/long-context shares in bp, cache-write tokens with a 5m or 1h TTL.
- price_table (object, required): Dated snapshot: snapshot_verified_on, currency USD, unit usd_micros_per_million_tokens, and models[] with tier, effective dates and micros prices.
- compare (array, required): Model names to price and rank, cheapest first; ties break by the model string.

## Sample

```json
{
  "as_of": "2026-10-01",
  "usage": {
    "requests_per_month": 100000,
    "input_tokens_per_request": 3000,
    "cached_input_share_bp": 0,
    "cache_write_tokens_per_request": 0,
    "cache_write_ttl": "5m",
    "output_tokens_per_request": 600,
    "batch_share_bp": 0,
    "long_context_share_bp": 0
  },
  "price_table": {
    "snapshot_verified_on": "2026-10-01",
    "currency": "USD",
    "unit": "usd_micros_per_million_tokens",
    "models": [
      {
        "provider": "anthropic",
        "model": "claude-haiku-4-5",
        "tier": "standard",
        "effective_from": null,
        "effective_through": null,
        "input": 1000000,
        "cached_input": 100000,
        "cache_write_5m": 1250000,
        "cache_write_1h": 2000000,
        "output": 5000000,
        "long_context": null,
        "batch": {
          "input": 500000,
          "output": 2500000
        },
        "source_sha256": "0101010101010101010101010101010101010101010101010101010101010101"
      }
    ]
  },
  "compare": [
    "claude-haiku-4-5"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `estimate_ai_token_spend` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

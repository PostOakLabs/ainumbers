# Perp Funding Implied Yield

Recomputes a perpetual-contract funding rate and its simple-annualized implied yield from caller-declared inputs, for either of two declared funding-mechanism variants: offshore-8h-twap (a continuous TWAP-sampled premium-index-plus-interest-rate-differential-clamp formula, the shape observed on offshore crypto perpetual venues) or kalshi-periodic (a simpler point-in-time price-differential reset, modeled against the CFTC's 2026 regulated-perpetual-contract framework). The funding mechanism, and every numeric parameter of it (interval length, clamp bound), is always a declared input, never an assumed default. An optional prev_funding_hash chains this print to its predecessor's own execution_hash, turning a series of same-pair prints into a walkable, cryptographically bound funding history. Complements the landed Prediction Market Artifact Validator (T631) in copy only, with no file overlap: that tool validates settlement artifacts for event markets, this one recomputes the ongoing funding-rate carry on a perpetual position. Verify-only: recomputes a caller-declared formula from caller-declared inputs, never fetches a live market price or a venue's actual current funding print, and never asserts that any venue's own published print matches this recompute. A declared input outside the domain (invalid mechanism, non-positive price, malformed prior-print hash, etc.) is rejected by name, never silently clamped or coerced.

- Page: https://ainumbers.co/chaingraph/art-654-perp-funding-implied-yield.html
- Markdown twin: https://ainumbers.co/chaingraph/art-654-perp-funding-implied-yield.md
- MCP tool: compute_perp_funding_implied_yield (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- clamp_pct (number, required): Percentage value
- funding_mechanism (unknown, required)
- index_price (number, required)
- interest_rate_pct (number, required): Percentage value
- interval_hours (number, required)
- mark_price (number, required)
- position_notional (number, required)
- position_side (unknown, required)
- premium_index_pct (number, required): Percentage value
- prev_funding_hash (unknown, required)
- venue (unknown, required)

## Outputs

- chained (boolean, required)
- clamp_pct (number,null, optional)
- disclaimer (string, optional)
- domain_errors (array, required)
- funding_mechanism (string,null, required)
- funding_payment (number,null, required)
- funding_payment_direction (string,null, required)
- funding_rate_pct (number,null, required)
- implied_annual_funding_yield_pct (number,null, required)
- index_price (number, optional)
- interest_rate_pct (number, optional)
- interval_hours (number, required)
- mark_price (number, optional)
- mechanism_note (string, optional)
- periods_per_year (number,null, required)
- position_notional (number, optional)
- position_side (string, required)
- premium_index_pct (number, optional)
- prev_funding_hash (null,string, required)
- scope_note (string, required)
- sign_convention_note (string, optional)
- venue (string,null, required)

## Sample

```json
{
  "funding_mechanism": "offshore-8h-twap",
  "venue": "hyperliquid",
  "mark_price": 65200,
  "index_price": 65000,
  "interval_hours": 8,
  "position_notional": 100000,
  "position_side": "long",
  "premium_index_pct": 0.02,
  "interest_rate_pct": 0.01,
  "clamp_pct": 0.05
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_perp_funding_implied_yield` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

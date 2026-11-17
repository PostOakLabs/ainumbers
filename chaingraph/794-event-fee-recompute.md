# Event Fee Recompute

Recomputes event-contract trading fees per fill and per order from an effective-dated venue fee profile, and diffs the recompute against a caller-reported fee (MATCH | OVERCHARGE | UNDERCHARGE). Venue-neutral: the fee family and its parameters are data; closed set parabolic (theta x C x p x (1-p)), multiplier (parabolic x series multiplier), linear, flat, rebate_share (a maker rebate equal to a declared share of the taker-equivalent fee, never a negative theta), combo (legs[]); with shipped effective-dated profile rows for Kalshi (per-fill trade fee ceiled to $0.000001 plus the pinned per-order rounding accumulator, taker theta 0.07 of par, combo maker fees 50% of taker), Polymarket global (pinned category rate table, 5-decimal rounding with the 0.00001 USDC minimum floor) and Polymarket US (taker theta 0.06 from the 2026-07-07 CFTC 40.6(d) letter, 0.0695 from 2026-09-17 per the 2026-09-29 letter, and the pinned combo curve C x p x [0.0695(1-p) + 0.04(1-p)^4] from 2026-09-25), plus a fully caller-declared generic profile whose rows mirror the fields of Kalshi GET /series/fee_changes so a scheduled change is one new row. Multi-outcome markets declare two or more opaque outcome labels. Integer arithmetic only; every fee path is BigInt over integer micro-dollar prices, because theta-numerator x contracts x price x (1e6 - price) products exceed 2^53 for real order sizes; no float appears in any fee path. Conservation is checked on every order: the order fee equals the fill trade fees plus the net carried rounding. Refusals (reachable, fixture-covered): an unknown profile id, a malformed as_of, any order_label or outcome label that looks like an account id, order id, address or hash (identifier-like values are never echoed), malformed order fields, and inputs outside the bounded domain. Scope limits: no account or order identifiers by schema, no live venue data at compute time, no legal verdicts and no trading advice; the node recomputes declared terms and reports arithmetic only; Robinhood, Crypto.com, ForecastEx and Coinbase profiles are deferred (only secondary, conflicting figures exist), and a tiered family is out of scope unless a primary tiered schedule is pinned. Adjacency: art-211 and art-212 compute whole-order fees inside their analyses; this node is the standalone per-fill recompute and edits neither.

- Page: https://ainumbers.co/chaingraph/794-event-fee-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/794-event-fee-recompute.md
- MCP tool: recompute_event_contract_fee (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required): Shipped profile id, or generic to declare every parameter from the caller. Any other string is refused.
- as_of (string, required): ISO calendar date selecting the effective profile row.
- category (string, optional): polymarket_global only: market category (crypto, sports, politics, other, combos and more). Defaults to other.
- balance_precision_micro (integer, optional): kalshi only: the member balance grid in micro-dollars. 10000 = non-direct ($0.01, default), 100 = direct ($0.0001).
- params (object, optional): Opaque synthetic label. Identifier-like values (hashes, addresses, long ids) are refused and never echoed.
- orders (array, required): Orders to recompute. At most 500 fills total. Aggregate only: no account or order identifiers.

## Outputs

- accumulator (boolean, required)
- as_of (string, required)
- category (string, optional)
- conservation_ok (boolean, required)
- effective_date_pinned (boolean, optional)
- effective_theta (object, required)
- evidence (object, required)
- fee_family (string, required)
- fill_rounding_unit_micro (number, required)
- fills_net_sum_micro (number, required)
- order_rounding_unit_micro (number, required)
- per_order (array, required)
- profile_id (string, required)
- rebate_share_bp (null,number, required)
- rounding_mode (string, required)
- series_multiplier (object, required)
- source_pin (string, required)
- total_fee_micro (number, required)
- venue_label (string, required)
- verdict (string, required)

## Sample

```json
{
  "profile": "kalshi",
  "as_of": "2026-10-31",
  "orders": [
    {
      "order_label": "fcm-example-one",
      "role": "taker",
      "fills": [
        {
          "contracts": 1,
          "price_micro": 55000
        }
      ],
      "reported_fee_minor": 5000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_event_contract_fee` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

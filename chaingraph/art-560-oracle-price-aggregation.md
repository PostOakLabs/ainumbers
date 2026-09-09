# Oracle Price Aggregation

Computes the aggregate price a decentralized oracle network would publish from a set of individual submissions, and gives that print its own citable execution_hash. Four aggregation mechanisms, each named by how it works rather than by any venue that runs it: median-filtered confidence-weighted mean (flag submissions deviating beyond a threshold from the unweighted median, then take the confidence-weighted mean of the survivors), stake-weighted median on the frequency convention (a submitter with twice the weight appears twice as often in the sorted list, never an average pulled toward the heavier weight), three-vote confidence median (each publisher votes price, price+confidence and price-confidence; the aggregate is the median of all votes and the aggregate confidence is the greater distance to the 25th and 75th percentile), and plain median with an f-of-n fault-tolerance readout. Supports an optional prev_print_hash citing the prior print of the same pair, which turns a series of same-pair prints into a walkable chain; omitting it reproduces the unlinked-print output byte for byte. HARD FENCE: every price, weight, confidence, timestamp and submitter id is supplied and asserted, never fetched (zero-egress); this simulates the aggregation step only, does not model the commit-reveal phase that precedes it, and never claims any real network did or would publish this number. A submitter id may be supplied as a sha256-salted commitment under SPEC.md section 25 to withhold the identifier while keeping the aggregation bound to it. Not a price feed and not a market-data source.

- Page: https://ainumbers.co/chaingraph/art-560-oracle-price-aggregation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-560-oracle-price-aggregation.md
- MCP tool: oracle_price_aggregation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mode (string, optional)
- currency_pair (string, optional)
- submissions (array, optional)
- outlier_threshold_pct (number, optional)
- stale_after_seconds (number, optional)
- epoch (number, optional)
- prev_print_hash (string, optional)

## Outputs

- currency_pair (string,null, optional)
- epoch (number,null, optional)
- structural_error (string,null, optional)
- aggregated_price (number,null, optional)
- aggregation_method (string,null, optional)
- aggregate_confidence (number,null, optional)
- submission_count (number, optional)
- priced_submission_count (number, optional)
- surviving_count (number,null, optional)
- outlier_count (number, optional)
- outliers_flagged (array, optional)
- outlier_detail (array, optional)
- outlier_threshold_pct (number,null, optional)
- price_spread_pct (number,null, optional)
- min_submitted (number,null, optional)
- max_submitted (number,null, optional)
- stale_submissions (array, optional)
- fault_tolerance (object,null, optional)
- rejected_inputs (array, optional)
- not_proven (array, optional)
- fence (string, optional)
- prev_print_hash (string, optional)
- chain_position (string, optional)

## Sample

```json
{
  "mode": "median_filtered_confidence_weighted_mean",
  "currency_pair": "EUR_USD",
  "submissions": [
    {
      "id": "sub-01",
      "price": 1.0823,
      "weight_pct": 4.2,
      "confidence": 0.005,
      "timestamp": "2026-08-08T12:00:00Z"
    },
    {
      "id": "sub-02",
      "price": 1.0819,
      "weight_pct": 3.8,
      "confidence": 0.0045,
      "timestamp": "2026-08-08T12:00:00Z"
    },
    {
      "id": "sub-03",
      "price": 1.12,
      "weight_pct": 5.1,
      "confidence": 0.006,
      "timestamp": "2026-08-08T12:00:00Z"
    }
  ],
  "outlier_threshold_pct": 3,
  "epoch": 14200
}
```

## Verify

Run the sample policy_parameters through MCP tool `oracle_price_aggregation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

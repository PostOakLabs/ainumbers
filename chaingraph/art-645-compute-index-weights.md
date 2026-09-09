# Compute Index Weights

Computes (or receipts an externally-declared) weight per constituent from a stated methodology (market-cap, float-adjusted-market-cap, equal-weight, price-weight, or factor-tilted) and caller-supplied inputs, giving the weight set its own citable execution_hash separate from the constituent-membership fact in art-557. HARD FENCE: every input row (market_cap/price/float_factor/factor_score) is supplied and asserted, never fetched (zero-egress); this attests THAT a weight set was computed exactly as stated from the declared inputs, never whether those inputs are accurate. weight_sum_check is a hard local check (sum of weights within 1e-9 of 1.0), not a re-fetch. constituents_ref is optional and backward-compatible: a caller with no art-557 artifact yet still gets a valid weighting receipt over its declared constituent list. Second entry of the Financial Index/Benchmark Administrator Lineage family. Not fund NAV recomputation (art-373) or any benchmark-publisher scorecard. EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) Art 12(1) and SEBI (Index Providers) Regulations, 2024 Reg 18(1)/18(3) citations informative only.

- Page: https://ainumbers.co/chaingraph/art-645-compute-index-weights.html
- Markdown twin: https://ainumbers.co/chaingraph/art-645-compute-index-weights.md
- MCP tool: compute_index_weights (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, optional)
- constituents_ref (unknown, required)
- index_id (unknown, optional)
- inputs (array, required)
- weighting_methodology (unknown, optional)

## Outputs

- as_of_date (string, optional)
- constituents_ref (object, optional)
- fence (string, optional)
- index_id (string, optional)
- methodology_notes (string, optional)
- not_proven (array, optional)
- regulatory_framework (string, optional)
- structural_error (string, optional)
- weight_sum_check (integer, optional)
- weight_sum_within_tolerance (boolean, optional)
- weighting_methodology (string, optional)
- weights (array, optional)

## Sample

```json
{
  "index_id": "IDX-DEMO-100",
  "as_of_date": "2026-08-05",
  "weighting_methodology": "market-cap",
  "inputs": [
    {
      "security_id": "SEC-A",
      "market_cap": 600,
      "currency": "USD"
    },
    {
      "security_id": "SEC-B",
      "market_cap": 400,
      "currency": "USD"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_index_weights` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

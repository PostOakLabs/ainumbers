# Currency Basket Index

Values a currency basket by the fixed-amount method, where currency amounts are fixed at a rebase date and the live weights float daily with FX, and gives that valuation its own citable execution_hash. Two modes. Valuation takes amounts already fixed and returns the index value as the sum of amount times USD rate, each component's live weight as its share of that total, and its drift from any stated target weight. Derivation is the non-obvious arithmetic this node owns: given target weights, a rebase-date index value and the rebase-date FX rates, it derives the fixed amounts that those weights imply, then values them at today's rates, so amounts are an output of the rebase rather than an input to it. Target weights that do not sum to one are refused rather than silently normalized, since a basket derived from them is not a basket. Integer-quantity baskets are supported through an amount scale. Per-pair rates may cite the upstream oracle prints they came from, which populates the chain parent hashes without entering the hash preimage. HARD FENCE: every FX rate, fixed amount and target weight is supplied and asserted, never fetched (zero-egress); this computes what the stated method yields on the stated numbers, never that those numbers are the correct rates for the stated date, and never a live basket publication.

- Page: https://ainumbers.co/chaingraph/art-561-currency-basket-index.html
- Markdown twin: https://ainumbers.co/chaingraph/art-561-currency-basket-index.md
- MCP tool: currency_basket_index (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mode (string, optional)
- basket_id (string, optional)
- as_of_date (string, optional)
- components (array, optional)
- index_value_at_rebase (number, optional)
- amount_scale (number, optional)
- prior_index_value (number, optional)
- parent_print_hashes (array, optional)

## Outputs

- basket_id (string,null, optional)
- as_of_date (string,null, optional)
- mode (string,null, optional)
- structural_error (string,null, optional)
- index_value (number,null, optional)
- components (array, optional)
- component_count (number, optional)
- dominant_contributor (string,null, optional)
- dominant_contribution_pct (number,null, optional)
- max_drift_from_target_pct (number,null, optional)
- basket_shift_pct (number,null, optional)
- target_weight_sum (number,null, optional)
- amount_scale (number, optional)
- parent_print_hashes (array, optional)
- rejected_inputs (array, optional)
- not_proven (array, optional)
- fence (string, optional)

## Sample

```json
{
  "mode": "fixed_amount_valuation",
  "basket_id": "BASKET-DEMO-5",
  "as_of_date": "2026-08-08",
  "components": [
    {
      "currency": "USD",
      "fixed_amount": 0.57813,
      "usd_rate": 1,
      "target_weight": 0.4338
    },
    {
      "currency": "EUR",
      "fixed_amount": 0.37379,
      "usd_rate": 1.0823,
      "target_weight": 0.2931
    },
    {
      "currency": "CNY",
      "fixed_amount": 1.0993,
      "usd_rate": 0.1392,
      "target_weight": 0.1228
    },
    {
      "currency": "JPY",
      "fixed_amount": 13.452,
      "usd_rate": 0.00675,
      "target_weight": 0.0759
    },
    {
      "currency": "GBP",
      "fixed_amount": 0.08087,
      "usd_rate": 1.2705,
      "target_weight": 0.0744
    }
  ],
  "prior_index_value": 1.3305
}
```

## Verify

Run the sample policy_parameters through MCP tool `currency_basket_index` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

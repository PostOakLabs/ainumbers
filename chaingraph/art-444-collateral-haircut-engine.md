# Collateral Haircut Engine (Basel CRE22)

Basel CRE22 comprehensive-approach collateral haircut engine for counterparty credit risk: applies a caller-supplied, versioned supervisory haircut table (policy input, not hardcoded) to each collateral item's asset class/maturity bucket, scales for a non-standard holding period via the CRE22.68 square-root-of-time rule, adds an FX-mismatch haircut where collateral currency differs from exposure currency, and computes net exposure E* = max(0, E*(1+He) - sum(C*(1-Hc-Hfx))). An item haircut override without a reason_code is flagged - the item-level basis for a separate signed §27 human_accountability_record, not minted by this kernel. An unmatched asset_class/maturity_bucket defaults to a conservative 100% haircut, flagged, never silently valued. Deterministic per-item haircut application and summation only - no collateral-to-exposure allocation/optimization solver. Not calculate_repo_haircut (508, Canton 24/7 timing-gap-specific SFT calculator) or compute_stock_token_collateral_haircut (art-320, RHC liquidation-risk layering) - this is the generic Basel comprehensive-approach net-exposure engine across asset classes and currencies. Not a capital-return filing tool - evidence artifact only, never regulator-submittable.

- Page: https://ainumbers.co/chaingraph/art-444-collateral-haircut-engine.html
- Markdown twin: https://ainumbers.co/chaingraph/art-444-collateral-haircut-engine.md
- MCP tool: compute_basel_haircut_adjusted_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collateral_items (unknown, required)
- exposure (unknown, required)
- fx_haircut_pct (number, optional): Percentage value
- haircut_table (unknown, required)
- haircut_table_version (unknown, required)
- holding_period_days (number, optional): Duration in days
- min_haircut_floor_pct (number, optional): Percentage value

## Outputs

- collateral_adjusted_total (integer, optional)
- collateral_items (array, optional)
- exposure_adjusted (integer, optional)
- exposure_amount (integer, optional)
- exposure_asset_class (string, optional)
- exposure_currency (string, optional)
- exposure_haircut_scaled_pct (integer, optional)
- haircut_table_version (string, optional)
- holding_period_days (integer, optional)
- item_count (integer, optional)
- net_exposure (integer, optional)
- note (string, optional)
- override_count (integer, optional)
- override_missing_reason_count (integer, optional)
- time_scale_factor (integer, optional)
- unclassified_count (integer, optional)

## Sample

```json
{
  "haircut_table_version": "2026-07-01",
  "holding_period_days": 10,
  "fx_haircut_pct": 8,
  "min_haircut_floor_pct": 0,
  "haircut_table": [
    {
      "asset_class": "sovereign_aaa_aa",
      "maturity_bucket": "0-1y",
      "haircut_pct": 0.5
    },
    {
      "asset_class": "sovereign_aaa_aa",
      "maturity_bucket": "1-5y",
      "haircut_pct": 2
    },
    {
      "asset_class": "sovereign_aaa_aa",
      "maturity_bucket": ">5y",
      "haircut_pct": 4
    },
    {
      "asset_class": "corporate_aaa_a",
      "maturity_bucket": "1-5y",
      "haircut_pct": 4
    },
    {
      "asset_class": "corporate_bbb",
      "maturity_bucket": "1-5y",
      "haircut_pct": 6
    },
    {
      "asset_class": "equity_main_index",
      "maturity_bucket": null,
      "haircut_pct": 15
    }
  ],
  "exposure": {
    "amount": 100000000,
    "currency": "USD",
    "asset_class": "cash"
  },
  "collateral_items": [
    {
      "item_id": "c0",
      "asset_class": "sovereign_aaa_aa",
      "maturity_bucket": "1-5y",
      "market_value": 60000000,
      "currency": "USD"
    },
    {
      "item_id": "c1",
      "asset_class": "corporate_aaa_a",
      "maturity_bucket": "1-5y",
      "market_value": 30000000,
      "currency": "USD"
    },
    {
      "item_id": "c2",
      "asset_class": "equity_main_index",
      "maturity_bucket": null,
      "market_value": 20000000,
      "currency": "EUR"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_basel_haircut_adjusted_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

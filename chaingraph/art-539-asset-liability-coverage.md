# Asset/Liability Coverage

General, jurisdiction-neutral solvency check: total_assets_musd / total_liabilities_musd, plus surplus_shortfall_musd = total_assets_musd - total_liabilities_musd, per asset-class and liability-class breakdown, rolled up. COVERED at or above 1.0, SHORTFALL below it. A zero-liabilities line resolves coverage_ratio null and status NO_LIABILITIES_OUTSTANDING - never a division artifact. Aggregate totals only (no per-customer or per-wallet line item). No single normative anchor exists for exchange-level asset/liability coverage (unlike bank capital-adequacy ratios elsewhere in the suite) - stated explicitly rather than inventing a crosswalk citation.

- Page: https://ainumbers.co/chaingraph/art-539-asset-liability-coverage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-539-asset-liability-coverage.md
- MCP tool: compute_asset_liability_coverage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assets (unknown, required)
- liabilities (unknown, required)

## Outputs

- asset_breakdown (array, optional)
- coverage_ratio (number, optional)
- formula (string, optional)
- liability_breakdown (array, optional)
- note (string, optional)
- status (string, optional)
- surplus_shortfall_musd (integer, optional)
- total_assets_musd (integer, optional)
- total_liabilities_musd (integer, optional)

## Sample

```json
{
  "assets": [
    {
      "asset_class": "cash",
      "amount_musd": 60
    },
    {
      "asset_class": "securities",
      "amount_musd": 30
    },
    {
      "asset_class": "digital_assets",
      "amount_musd": 25
    }
  ],
  "liabilities": [
    {
      "liability_class": "payables",
      "amount_musd": 40
    },
    {
      "liability_class": "accrued_liabilities",
      "amount_musd": 20
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_asset_liability_coverage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

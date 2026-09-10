# Custody Segregation Ratio

Generic, jurisdiction-neutral custody-segregation check: segregated_custody_assets_musd / customer_claims_musd, per asset class and rolled up. FULLY_SEGREGATED at or above 1.0, UNDER_SEGREGATED below it, OVER_SEGREGATED above an optional configurable ceiling. A zero-claims line resolves segregation_ratio null and status NO_CLAIMS_OUTSTANDING - never a division artifact. Aggregate totals only (no per-customer or per-wallet line item). SEC Rule 15c3-3 possession-or-control (17 CFR 240.15c3-3(b)) is named as one crosswalk-annex instance among possibly several - the arithmetic does not depend on that citation, and the SEC 15c3-3 Exhibit A reserve formula stays a distinct, unedited node (art-396).

- Page: https://ainumbers.co/chaingraph/art-538-custody-segregation-ratio.html
- Markdown twin: https://ainumbers.co/chaingraph/art-538-custody-segregation-ratio.md
- MCP tool: compute_custody_segregation_ratio (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- over_segregation_ceiling (number, optional)
- segregated_assets (array, optional)
- customer_claims (array, optional)

## Outputs

- line_items (array, optional)
- total_segregated_musd (number, optional)
- total_claims_musd (number, optional)
- segregation_ratio (number,null, optional)
- status (string, optional)
- over_segregation_ceiling (number,null, optional)
- custody_location_breakdown (object, optional)
- formula (string, optional)
- note (string, optional)

## Sample

```json
{
  "segregated_assets": [
    {
      "asset_class": "cash",
      "custody_location_type": "qualified_custodian_bank",
      "amount_musd": 60
    },
    {
      "asset_class": "securities",
      "custody_location_type": "qualified_custodian_bank",
      "amount_musd": 30
    },
    {
      "asset_class": "BTC",
      "custody_location_type": "cold_storage_multisig",
      "amount_musd": 25
    }
  ],
  "customer_claims": [
    {
      "asset_class": "cash",
      "amount_musd": 50
    },
    {
      "asset_class": "securities",
      "amount_musd": 30
    },
    {
      "asset_class": "BTC",
      "amount_musd": 20
    }
  ],
  "over_segregation_ceiling": null
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_custody_segregation_ratio` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

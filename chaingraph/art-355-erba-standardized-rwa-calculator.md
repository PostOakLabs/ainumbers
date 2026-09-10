# ERBA / Standardized RWA Calculator (Basel Endgame 2026)

Credit-risk expanded risk-based approach (ERBA) / standardized-approach RWA calculator per the 2026 Basel Endgame reproposal (BCBS/US NPR, reproposed 2026-03-19, comments closed 2026-06-18, final expected ~Q4 2026). Runs an exposure book - residential real estate by LTV band, retail (QRRE transactor/revolver, other retail), corporate (ECRA external-rating or SCRA unrated), SME support factor, off-balance-sheet CCFs - through a chosen rule_set (2023 original NPR or 2026 reproposal) and returns per-exposure risk weights, aggregate RWA, and a receipt. rule_status stays proposed until the rule finalizes. Feeds compare_basel_2023_vs_2026 for the versus-2023 capital delta.

- Page: https://ainumbers.co/chaingraph/art-355-erba-standardized-rwa-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-355-erba-standardized-rwa-calculator.md
- MCP tool: compute_rwa_erba_2026 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exposures (array, required)
- rule_set (unknown, required)

## Outputs

- aggregate_rwa (integer, optional)
- average_risk_weight (number, optional)
- constants_version (string, optional)
- disambiguation (string, optional)
- exposure_count (integer, optional)
- per_exposure (array, optional)
- rule_set (string, optional)
- rule_set_label (string, optional)
- rule_status (string, optional)
- table_source (string, optional)
- total_exposure_amount (integer, optional)

## Sample

```json
{
  "rule_set": "2026",
  "exposures": [
    {
      "id": "e1",
      "category": "residential_re",
      "exposure_amount": 200000,
      "ltv": 75
    },
    {
      "id": "e2",
      "category": "retail_qrre_transactor",
      "exposure_amount": 5000
    },
    {
      "id": "e3",
      "category": "corporate",
      "exposure_amount": 1000000,
      "external_rating": "BBB"
    },
    {
      "id": "e4",
      "category": "corporate",
      "exposure_amount": 500000,
      "sme": true,
      "external_rating": "BB"
    },
    {
      "id": "e5",
      "category": "off_balance",
      "exposure_amount": 300000,
      "commitment_type": "unconditionally_cancellable"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_rwa_erba_2026` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

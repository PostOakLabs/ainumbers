# PE Distribution Waterfall LP-Side Recompute

Recomputes a standard 4-tier PE distribution waterfall (return of capital, preferred return, GP catch-up, residual carry split) from caller-DECLARED dated contribution/distribution cashflows and a caller-DECLARED waterfall parameterization (pref rate + compounding basis, GP catch-up percentage, carry percentage, European whole-fund or American deal-by-deal tier structure, optional clawback check), then diffs the recomputed per-tier LP/GP allocation against a caller-supplied GP-reported allocation. Verdict MATCHES, DIVERGES with per-tier deltas, or INDETERMINATE whenever a required parameter is absent - never guessed, never defaulted. ILPA's own reporting-template guidance states it was not designed for verifying any of the GP's calculations, cited here only as dated gap evidence, never as an ILPA endorsement or ILPA-compliance claim. Cross-links recompute_fund_nav (art-373), which recomputes NAV, not distribution waterfalls - the two do not duplicate each other. Zero network, zero PII, fixed-point BigInt money math throughout.

- Page: https://ainumbers.co/chaingraph/art-567-pe-waterfall-lp-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-567-pe-waterfall-lp-recompute.md
- MCP tool: recompute_pe_waterfall_lp (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, optional)
- cashflows (array, required)
- deal_id (unknown, optional)
- fund_id (unknown, optional)
- gp_reported_allocation (unknown, required)
- waterfall (unknown, required)

## Outputs

- as_of_date (string, optional)
- clawback (object, optional)
- deal_id (string, optional)
- fence (string, optional)
- fund_id (string, optional)
- gp_reported_allocation (object, optional)
- ilpa_context (string, optional)
- not_proven (array, optional)
- per_deal (string, optional)
- recomputed_allocation (array, optional)
- rejected_inputs (array, optional)
- tier_deltas (array, optional)
- tier_structure (string, optional)
- verdict (string, optional)
- waterfall (object, optional)

## Sample

```json
{
  "fund_id": "FUND-A",
  "waterfall": {
    "pref_rate": 0.08,
    "compounding_basis": "simple",
    "day_count_convention": "actual/365",
    "gp_catchup_pct": 1,
    "carry_pct": 0.2,
    "tier_structure": "european_whole_fund",
    "clawback_flag": true
  },
  "cashflows": [
    {
      "date": "2025-01-01",
      "type": "contribution",
      "amount": 1000000
    },
    {
      "date": "2026-01-01",
      "type": "distribution",
      "amount": 1300000
    }
  ],
  "gp_reported_allocation": {
    "tiers": [
      {
        "tier": "return_of_capital",
        "lp_amount": 1000000,
        "gp_amount": 0
      },
      {
        "tier": "preferred_return",
        "lp_amount": 80000,
        "gp_amount": 0
      },
      {
        "tier": "gp_catchup",
        "lp_amount": 0,
        "gp_amount": 20000
      },
      {
        "tier": "carry_residual",
        "lp_amount": 160000,
        "gp_amount": 40000
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_pe_waterfall_lp` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

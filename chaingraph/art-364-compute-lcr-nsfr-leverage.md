# LCR / NSFR / Leverage Ratio Calculator

Basel III Liquidity Coverage Ratio (BCBS 238), Net Stable Funding Ratio (BCBS 295), and Leverage Ratio (BCBS 270, finalized BCBS 360) point-in-time calculator from caller-supplied HQLA positions, outflow/inflow categories, ASF/RSF items, and capital/exposure figures. Deterministic single-scenario point calculation, distinct from the Monte Carlo stress distribution in sim-01-lcr-nsfr-liquidity-stress-test. Provable node counterpart to tools/469-lcr-calculator.html, tools/470-nsfr-calculator.html, and tools/471-leverage-ratio-calculator.html.

- Page: https://ainumbers.co/chaingraph/art-364-compute-lcr-nsfr-leverage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-364-compute-lcr-nsfr-leverage.md
- MCP tool: compute_lcr_nsfr_leverage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- lcr (unknown, required)
- leverage (unknown, required)
- nsfr (unknown, required)

## Outputs

- lcr (object, optional)
- leverage (object, optional)
- note (string, optional)
- nsfr (object, optional)
- regulatory_basis (string, optional)

## Sample

```json
{
  "lcr": {
    "hqla_positions": [
      {
        "level": "l1",
        "market_value_musd": 5000
      },
      {
        "level": "l2a",
        "market_value_musd": 2000
      },
      {
        "level": "l2b",
        "market_value_musd": 500
      }
    ],
    "outflows": [
      {
        "label": "Retail stable deposits",
        "balance_musd": 8000,
        "rate_pct": 5
      },
      {
        "label": "Retail less-stable deposits",
        "balance_musd": 3000,
        "rate_pct": 10
      },
      {
        "label": "Wholesale deposits - financial institution",
        "balance_musd": 500,
        "rate_pct": 100
      },
      {
        "label": "Committed credit facilities - non-financial corporates",
        "balance_musd": 2000,
        "rate_pct": 10
      }
    ],
    "inflows": [
      {
        "label": "Retail customer inflows",
        "balance_musd": 1000,
        "rate_pct": 50
      },
      {
        "label": "Non-financial corporate inflows",
        "balance_musd": 800,
        "rate_pct": 50
      }
    ]
  },
  "nsfr": {
    "asf_items": [
      {
        "label": "Tier 1 + Tier 2 regulatory capital",
        "amount_musd": 8000,
        "factor_pct": 100
      },
      {
        "label": "Retail stable deposits >=1yr",
        "amount_musd": 5000,
        "factor_pct": 95
      },
      {
        "label": "Retail less-stable <1yr",
        "amount_musd": 2000,
        "factor_pct": 90
      },
      {
        "label": "Other liabilities residual <1yr",
        "amount_musd": 3000,
        "factor_pct": 0
      }
    ],
    "rsf_items": [
      {
        "label": "Unencumbered Level 1 HQLA",
        "amount_musd": 5000,
        "factor_pct": 5
      },
      {
        "label": "Loans to retail/SME <1yr",
        "amount_musd": 4000,
        "factor_pct": 50
      },
      {
        "label": "Loans to non-financial corporate >=1yr",
        "amount_musd": 3000,
        "factor_pct": 65
      },
      {
        "label": "All other assets residual",
        "amount_musd": 2000,
        "factor_pct": 100
      }
    ]
  },
  "leverage": {
    "cet1_musd": 5000,
    "at1_musd": 500,
    "gsib_bucket": 0,
    "onbs_exposure_musd": 60000,
    "derivative_exposure_musd": 3000,
    "sft_exposure_musd": 5000,
    "offbs_exposure_musd": 2000,
    "other_exposure_musd": 0
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_lcr_nsfr_leverage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

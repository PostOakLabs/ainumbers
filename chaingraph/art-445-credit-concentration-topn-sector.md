# Credit Concentration Top-N / Sector Checker

Credit-concentration screen over a flat exposure list (name, sector, amount): returns the top-N single-name exposures by amount, a per-sector rollup, single-name and sector Herfindahl-Hirschman Index (0-10000 scale), and a breach list against caller-declared single-name and sector limit percentages. Concentration limits are your own institution's risk-appetite policy, not a fixed regulatory threshold, so nothing is baked in. Distinct from the shipped IRRBB/NII shock kernels (art-183/art-185/art-369), which measure rate-risk exposure rather than name/sector diversification. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-445-credit-concentration-topn-sector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-445-credit-concentration-topn-sector.md
- MCP tool: check_credit_concentration_topn_sector (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exposures (array, required)
- sector_limit_pct (unknown, required): Percentage value
- single_name_limit_pct (unknown, required): Percentage value
- top_n (unknown, required)

## Outputs

- portfolio_total (integer, optional)
- sector_breaches (array, optional)
- sector_hhi (number, optional)
- sector_limit_pct (integer, optional)
- sector_totals (array, optional)
- single_name_breaches (array, optional)
- single_name_hhi (number, optional)
- single_name_limit_pct (integer, optional)
- top_n (integer, optional)
- top_n_exposures (array, optional)
- worst_sector (string, optional)
- worst_single_name (string, optional)

## Sample

```json
{
  "exposures": [
    {
      "name": "A",
      "sector": "Retail",
      "amount": 1200000
    },
    {
      "name": "B",
      "sector": "Retail",
      "amount": 800000
    },
    {
      "name": "C",
      "sector": "Energy",
      "amount": 2500000
    },
    {
      "name": "D",
      "sector": "Energy",
      "amount": 500000
    },
    {
      "name": "E",
      "sector": "Tech",
      "amount": 400000
    },
    {
      "name": "F",
      "sector": "Healthcare",
      "amount": 600000
    }
  ],
  "top_n": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_credit_concentration_topn_sector` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

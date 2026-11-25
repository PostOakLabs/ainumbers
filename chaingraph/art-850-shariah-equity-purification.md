# Shariah Equity Purification

Screens one company's caller-supplied financials under four pinned Shariah screening methodologies, each as its own independent verdict group that is never merged with another: the long-form ratios at 33.33% of total assets (30% for new entrants), the 36-month average month-end market-cap variant with its widened receivables row, the daily-average screens at 33% of the supplied average market cap with a fallback to total assets when the average falls below the asset value, a 5% business-activity row and a 5% non-permissible-income row, and the conservative 25%/3%/90% screen with imputed returns at 7.5%. Every threshold comparison is exact integer cross-multiplication (equality passes, one minor unit over fails), amounts are integer minor units with declared bounds, averages are reported floored with named rounding while verdicts use exact values, the compliant-debt country carve-out subtracts only for eleven pinned country codes, and dividend purification runs per profile (long-form adjustment factor, conservative pro-rata ratio, named residuals; the daily-average profile pins no purification rule and says so). Methodologies it does not implement, such as S&P Shariah, Dow Jones Islamic Market, Malaysia SC SAC screening and AAOIFI SS 21, refuse by name rather than approximating. Every payload carries not_a_shariah_ruling: the node outputs verdict rows and purification arithmetic only, never a ruling, certification or opinion.

- Page: https://ainumbers.co/chaingraph/art-850-shariah-equity-purification.html
- Markdown twin: https://ainumbers.co/chaingraph/art-850-shariah-equity-purification.md
- MCP tool: screen_shariah_equity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- methodologies (array, optional)
- is_current_constituent (boolean, optional)
- country_code (string, optional)
- shariah_compliant_debt_minor (integer, optional)
- total_assets_minor (integer, optional)
- total_debt_minor (integer, optional)
- cash_and_interest_bearing_securities_minor (integer, optional)
- receivables_minor (integer, optional)
- total_revenue_minor (integer, optional)
- non_permissible_revenue_minor (integer, optional)
- interest_income_minor (integer, optional)
- total_income_minor (integer, optional)
- interest_based_investments_minor (integer, optional)
- market_cap_series_minor (array, optional)
- market_cap_series_period (string, optional)
- dividend_minor (integer, optional)

## Outputs

- valid_input (boolean, required)
- not_a_shariah_ruling (boolean, required)
- methodologies (array,null, optional)
- verdicts (object,null, required)
- domain_errors (array, optional)
- purification (object,null, optional)
- warnings (array, required)

## Sample

```json
{
  "methodologies": [
    "msci_islamic",
    "nifty_tasis"
  ],
  "is_current_constituent": true,
  "country_code": "US",
  "total_assets_minor": 100000000,
  "total_debt_minor": 28000000,
  "cash_and_interest_bearing_securities_minor": 5000000,
  "receivables_minor": 5000000,
  "non_permissible_revenue_minor": 1000000,
  "interest_income_minor": 2000000,
  "total_income_minor": 100000000,
  "interest_based_investments_minor": 0,
  "dividend_minor": 10000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `screen_shariah_equity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

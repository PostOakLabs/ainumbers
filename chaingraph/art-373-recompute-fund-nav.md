# Recompute Fund NAV

Recomputes a fund's net-asset-value-per-share from SUPPLIED holdings (quantity x supplied price, multi-currency with supplied FX), accruals (income and expense with a declared day-count convention), liabilities, and shares outstanding, using fixed-point BigInt money math throughout (no float accumulation). Applies a declared rounding mode (e.g. $0.0001 for a money-market fund vs $0.01 for a standard fund) and returns a full component breakdown. HARD FENCE: every price and FX rate is supplied and asserted, never fetched (zero-egress); this recomputes the arithmetic over declared inputs and attests THAT, never a fair-value opinion, never an independent valuation, never live market data. First entry of the Funds/NAV family (nav-verification-pack) alongside test_nav_error_materiality (FN-2) and compute_fund_expense_ratios (FN-3). Not fund_share_class_composer (asset allocation) or any pricing/valuation tool. 40-Act/UCITS citations informative only.

- Page: https://ainumbers.co/chaingraph/art-373-recompute-fund-nav.html
- Markdown twin: https://ainumbers.co/chaingraph/art-373-recompute-fund-nav.md
- MCP tool: recompute_fund_nav (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- accruals (array, required)
- base_currency (unknown, optional)
- fund_id (unknown, optional)
- holdings (array, required)
- liabilities (array, required)
- rounding (unknown, required)
- shares_outstanding (unknown, required)
- valuation_date (unknown, optional)

## Outputs

- base_currency (string, optional)
- components (object, optional)
- fence (string, optional)
- fund_id (string, optional)
- nav_per_share (string, optional)
- not_proven (array, optional)
- regulatory_framework (string, optional)
- rounding (object, optional)
- structural_error (string, optional)
- valuation_date (string, optional)

## Sample

```json
{
  "fund_id": "FUND-STD-01",
  "valuation_date": "2026-07-18",
  "base_currency": "USD",
  "holdings": [
    {
      "security_id": "SEC-A",
      "quantity": 1000,
      "price": 10.005,
      "currency": "USD",
      "fx_rate_to_base": 1
    },
    {
      "security_id": "SEC-B",
      "quantity": 500,
      "price": 20.02,
      "currency": "USD",
      "fx_rate_to_base": 1
    }
  ],
  "liabilities": [],
  "shares_outstanding": 15000,
  "rounding": {
    "decimal_places": 2,
    "mode": "half_up"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_fund_nav` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

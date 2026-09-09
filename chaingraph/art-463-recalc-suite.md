# Audit Recalculation Suite

Independently recalculates five caller-supplied audit schedule types (straight-line/double-declining-balance/units-of-production depreciation, interest accrual, EPS basic and diluted, straight-line intangible amortization, and prepaid-expense roll-forwards) and diffs each recalculated figure against the client's stated figure. A category only runs when the caller supplies items for it. The variance threshold gate (tolerance_abs, tolerance_pct) is a caller-declared policy input with an explicit, echoed default of 0/0 (flag any nonzero variance) when the caller declares neither - there is no silent, unrecorded tolerance. EPS diluted uses the simplified NI-less-preferred-dividends-over-diluted-shares form; it does not model if-converted or treasury-stock adjustments for specific convertible instruments, a judgment-heavy extension out of this kernel's deterministic-recalc scope. Second of three ARCB-K-1 substantive audit-recalculation kernels. NaN-safe; a zero-denominator ratio resolves to null, never NaN/Infinity. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-463-recalc-suite.html
- Markdown twin: https://ainumbers.co/chaingraph/art-463-recalc-suite.md
- MCP tool: run_audit_recalc_suite (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amortization (unknown, required)
- depreciation (unknown, required)
- eps (unknown, required)
- interest_accrual (unknown, required)
- prepaid_rollforward (unknown, required)
- tolerance (unknown, required)

## Outputs

- amortization (array, optional)
- categories_run (array, optional)
- depreciation (array, optional)
- eps (array, optional)
- flagged_count (integer, optional)
- interest_accrual (array, optional)
- prepaid_rollforward (array, optional)
- tolerance_used (object, optional)
- total_items (integer, optional)

## Sample

```json
{
  "tolerance": {
    "abs": 0,
    "pct": 5
  },
  "depreciation": [
    {
      "asset_id": "A-1",
      "method": "straight_line",
      "cost": 10000,
      "salvage_value": 1000,
      "useful_life_years": 9,
      "period_number": 1,
      "client_reported_depreciation": 1000
    }
  ],
  "interest_accrual": [
    {
      "item_id": "I-1",
      "principal": 100000,
      "annual_rate_pct": 6,
      "days_accrued": 90,
      "day_count_basis": "actual_360",
      "client_reported_interest": 1490
    }
  ],
  "eps": [
    {
      "label": "FY2026",
      "net_income": 5000000,
      "preferred_dividends": 200000,
      "weighted_avg_shares_basic": 1000000,
      "weighted_avg_shares_diluted": 1100000,
      "client_reported_eps_basic": 4.8,
      "client_reported_eps_diluted": 3.8
    }
  ],
  "amortization": [
    {
      "item_id": "M-1",
      "principal": 120000,
      "periods_total": 10,
      "client_reported_amortization": 12000
    }
  ],
  "prepaid_rollforward": [
    {
      "item_id": "P-1",
      "beginning_balance": 50000,
      "additions": 10000,
      "amortized_current_period": 5000,
      "client_reported_ending_balance": 60000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_audit_recalc_suite` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

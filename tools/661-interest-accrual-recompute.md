# Interest Accrual Recompute

Recomputes per-day interest accrual from caller-supplied daily principal balances and product terms (day-count convention, compounding basis, fixed or tiered rate), then diffs the recomputed cumulative accrual against the core's own posted accrual/interest-paid ledger entries at each of the core's own posting dates. Returns MATCHES, DIVERGES with the first divergent date and cent amount, or INDETERMINATE when no core postings exist to diff against. An independent recompute-and-receipt over a caller-declared contract term (day-count/compounding), not an audit of or substitution for any core platform, and not a claim about which convention a core should use.

- Page: https://ainumbers.co/tools/661-interest-accrual-recompute.html
- Markdown twin: https://ainumbers.co/tools/661-interest-accrual-recompute.md
- MCP tool: compute_interest_accrual_recompute (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "daily_balances": [
    {
      "date": "2026-01-01",
      "principal_balance_cents": 100000
    },
    {
      "date": "2026-01-02",
      "principal_balance_cents": 100000
    },
    {
      "date": "2026-01-03",
      "principal_balance_cents": 100000
    },
    {
      "date": "2026-01-04",
      "principal_balance_cents": 100000
    },
    {
      "date": "2026-01-05",
      "principal_balance_cents": 100000
    }
  ],
  "core_reported_accruals": [
    {
      "date": "2026-01-05",
      "amount_cents": 70
    }
  ],
  "product_terms": {
    "day_count_convention": "actual/365",
    "compounding": "none",
    "rate_type": "fixed",
    "rate_value": 0.05
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_interest_accrual_recompute` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

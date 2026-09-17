# 15c3-3 Customer Reserve Formula Calculator

SEC Rule 15c3-3 Exhibit A customer reserve formula: credit items (customer free credit balances, margin credit balances, payables) against allowable debit items (margin-account debits with the 1% collateral haircut, failed-to-deliver debits with the 30-day aging exclusion, other allowable debits) to a reserve requirement, deposit-sufficiency verdict, and line-item receipt. Simplified over a representative subset of Exhibit A line items with a PAB (proprietary-account-of-broker-dealer) variant flag; attests the computation over caller-supplied inputs only, not an audit of those inputs or a determination of regulatory compliance. Whole-rule applicability is assumed rather than tested: the 17 CFR 240.15c3-3(k) exemptions have no inputs, so a broker-dealer within (k)(1) (dealing exclusively in investment-company shares or certain insurance products), (k)(2)(i) (carrying a Special Account for the Exclusive Benefit of Customers), (k)(2)(ii) (introducing on a fully disclosed basis to a clearing broker), or (k)(3) (exempted by Commission order) still receives an Exhibit A reserve computation rather than a not-applicable verdict.

- Page: https://ainumbers.co/chaingraph/art-396-compute-15c3-3-reserve.html
- Markdown twin: https://ainumbers.co/chaingraph/art-396-compute-15c3-3-reserve.md
- MCP tool: compute_15c3_3_reserve (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- credit_items (unknown, required)
- debit_items (unknown, required)
- pab_variant (boolean, required)
- reserve_account_balance_musd (number, optional)

## Outputs

- credit_items (array, optional)
- debit_items (array, optional)
- deposit_sufficient (boolean, optional)
- note (string, optional)
- pab_variant (boolean, optional)
- regulatory_basis (string, optional)
- reserve_account_balance_musd (integer, optional)
- reserve_requirement_musd (number, optional)
- rules_version (string, optional)
- surplus_shortfall_musd (number, optional)
- total_credits_musd (integer, optional)
- total_debits_musd (number, optional)

## Sample

```json
{
  "credit_items": [
    {
      "label": "Free credit balances",
      "category": "free_credit_balances",
      "amount_musd": 40
    },
    {
      "label": "Margin credit balances",
      "category": "margin_credit_balances",
      "amount_musd": 12
    },
    {
      "label": "Payable from securities loaned using customer securities",
      "category": "payable_from_securities_loaned_using_customer_securities",
      "amount_musd": 5
    }
  ],
  "debit_items": [
    {
      "label": "Margin account debits",
      "category": "margin_account_debit",
      "amount_musd": 20,
      "aging_days": 5
    },
    {
      "label": "Securities failed to deliver (10d)",
      "category": "securities_failed_to_deliver",
      "amount_musd": 3,
      "aging_days": 10
    }
  ],
  "reserve_account_balance_musd": 35,
  "pab_variant": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_15c3_3_reserve` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

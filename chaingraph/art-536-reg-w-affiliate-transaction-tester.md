# Reg W Affiliate Transaction Tester

Tests each caller-declared covered transaction with an affiliate against the Regulation W (12 CFR 223) quantitative limits: the 10% single-affiliate and 20% aggregate-affiliate capital limits, and a collateral-coverage percentage requirement on covered credit transactions. Capital base, both limit percentages, and the collateral-coverage percentage all arrive as caller-declared policy_parameters, cited with a required policy_vintage - never hardcoded, since 12 CFR 223 figures version on their own schedule. A market-terms flag (the qualitative 12 CFR 223.51 'on terms substantially the same' test) is a caller-declared boolean the node records for the artifact only; it is never a judgment this node makes. Either quantitative limit breached escalates; a collateral shortfall with no capital breach routes to review_required; both limits satisfied and full collateral coverage auto-passes. No policy_parameters or no declared transactions yields a did-not-run execution state rather than a guessed decision. Two further parts of Regulation W sit outside the input space and are not evaluated. First, the exemption inventory: covered-transaction status is caller-declared, and the subpart E exemptions of 12 CFR 223.41 and 223.42, the collateral-requirement exemptions of 223.14(f), and the exclusions of 223.16(c) have no inputs, so a transaction within any of them is still tested against the quantitative limits; the 223.15 prohibition on purchasing a low-quality asset from an affiliate is not evaluated either. Second, the collateral ladder: 223.14(b)(1)(i)-(iv) sets 100, 110, 120, or 130 percent according to collateral class (obligations of the United States or its agencies; obligations of a state or political subdivision; other debt instruments; and stock, leases, or other real or personal property), and collateral class is not an input, so the fact that selects the rung reaches this node already resolved into the caller's collateral-coverage percentage.

- Page: https://ainumbers.co/chaingraph/art-536-reg-w-affiliate-transaction-tester.html
- Markdown twin: https://ainumbers.co/chaingraph/art-536-reg-w-affiliate-transaction-tester.md
- MCP tool: test_reg_w_affiliate_transactions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aggregate_affiliate_limit_pct (unknown, required): Percentage value
- capital_base (unknown, required)
- collateral_coverage_required_pct (unknown, required): Percentage value
- policy_vintage (unknown, required)
- single_affiliate_limit_pct (unknown, required): Percentage value
- transactions (array, required)

## Outputs

- aggregate_test (object, optional)
- collateral_tests (array, optional)
- decision (string, optional)
- execution_state (string, optional)
- market_terms_declarations (array, optional)
- policy_vintage (string, optional)
- reason (string, optional)
- single_affiliate_tests (array, optional)

## Sample

```json
{
  "policy_vintage": "12 CFR 223, eCFR as of 2026-01-01",
  "capital_base": 10000000,
  "single_affiliate_limit_pct": 10,
  "aggregate_affiliate_limit_pct": 20,
  "collateral_coverage_required_pct": 130,
  "transactions": [
    {
      "affiliate_id": "affiliate-alpha-holdings",
      "transaction_id": "txn-0001",
      "transaction_type": "credit",
      "amount": 300000,
      "collateral_value": 400000,
      "market_terms_substantially_same": true
    },
    {
      "affiliate_id": "affiliate-alpha-holdings",
      "transaction_id": "txn-0002",
      "transaction_type": "other",
      "amount": 200000,
      "collateral_value": null,
      "market_terms_substantially_same": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `test_reg_w_affiliate_transactions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

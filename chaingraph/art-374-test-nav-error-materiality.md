# Test NAV-Error Materiality

Compares an erroneous NAV-per-share against a corrected NAV-per-share against a DECLARED materiality policy (the industry half-cent absolute and 1% relative conventions, plus the fund's own policy taken as an input) using fixed-point BigInt money math throughout. Returns a material/immaterial verdict, affected-period math, an estimated impact figure, and a reprocessing-need indication. The fund-ops incident artifact. HARD FENCE: the erroneous and corrected NAV values are supplied and asserted, never independently recomputed here; this attests the arithmetic of the error comparison against a declared policy, never an accounting opinion, never a determination that a fund must reprocess, never advice. Second entry of the Funds/NAV family (nav-verification-pack) alongside recompute_fund_nav (FN-1) and compute_fund_expense_ratios (FN-3). Not recompute_fund_nav (independent NAV recomputation) or any fair-value/pricing tool.

- Page: https://ainumbers.co/chaingraph/art-374-test-nav-error-materiality.html
- Markdown twin: https://ainumbers.co/chaingraph/art-374-test-nav-error-materiality.md
- MCP tool: test_nav_error_materiality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- affected_period (unknown, required)
- corrected_nav_per_share (unknown, required)
- erroneous_nav_per_share (unknown, required)
- fund_id (unknown, optional)
- materiality_policy (unknown, required)
- shares_outstanding (unknown, required)
- valuation_date (unknown, optional)

## Outputs

- affected_period (object, optional)
- declared_policy (object, optional)
- error (object, optional)
- estimated_impact (string, optional)
- fence (string, optional)
- fund_id (string, optional)
- industry_convention (object, optional)
- materiality_verdict (string, optional)
- not_proven (array, optional)
- regulatory_framework (string, optional)
- reprocessing_need_indicated (boolean, optional)
- shares_outstanding (string, optional)
- structural_error (string, optional)
- valuation_date (string, optional)

## Sample

```json
{
  "fund_id": "FUND-A",
  "valuation_date": "2026-07-18",
  "erroneous_nav_per_share": 10.001,
  "corrected_nav_per_share": 10
}
```

## Verify

Run the sample policy_parameters through MCP tool `test_nav_error_materiality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

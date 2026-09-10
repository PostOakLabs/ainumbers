# Education Funding Gap Calculator

Computes the arithmetic of a declared education funding plan: the future value of a declared current balance grown at a declared annual return over a declared horizon, and the funding gap against a declared goal, returning GAP_COMPUTED or GOAL_MET with a full trace. Every input is a caller-declared synthetic value; no account, plan record, market feed, or clock is read. The overfunded-to-Roth rollover note on the GOAL_MET path echoes a caller-declared lifetime rollover cap; the statutory reference for that cap is the SECURE 2.0 Act of 2022, Division T, Section 126 (Public Law 117-328, enacted 2022-12-29), which added the 529-to-Roth IRA rollover with a 35000 USD lifetime limit per beneficiary beginning 2024 (subject to a 15-year account-age rule and annual Roth contribution limits); measured 2026-09-05; derive: read Public Law 117-328, Division T, sec. 126. The kernel never recommends a contribution amount, a plan, or a rollover; it is arithmetic over declarations, not advice. The contribution solver is out of scope for v1.

- Page: https://ainumbers.co/tools/688-education-funding-gap-calculator.html
- Markdown twin: https://ainumbers.co/tools/688-education-funding-gap-calculator.md
- MCP tool: compute_education_funding_gap_calculator (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "goal": 120000,
  "years": 10,
  "annual_return_pct": 5,
  "current_balance": 20000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_education_funding_gap_calculator` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

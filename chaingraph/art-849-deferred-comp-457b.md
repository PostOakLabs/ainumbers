# Deferred Comp 457(b) Comparison

Deferred Comp 457(b) comparison ported from ApexLogics Apex #44 (AL-49). For a single annual deferral (annual income echo, deferral amount, current and retirement marginal rates, years to retirement, growth rate, drawdown years, taxable-account return, long-term capital gains rate) the node compares scenario A, deferring pre-tax into a 457(b) that grows tax-deferred and is taxed on withdrawal, against scenario B, taking the pay and investing the after-tax cash in a taxable account taxed on gains at liquidation. It returns tax saved today, both ending balances, the level annual after-tax withdrawal, total after-tax value, the present value of each drawdown discounted at the growth rate, the total and present-value advantage, the break-even retirement rate (clamped to 0 to 100 percent) and a FAVORS_457B or FAVORS_TAXABLE verdict. It also names the smallest 2026 limit tier that would permit the deferral (standard 24,500 USD, plus 8,000 age 50 catch-up, plus 11,250 ages 60 to 63 catch-up, special catch-up up to 49,000) without testing eligibility. Every input is refused rather than coerced when absent, null, mistyped or out of its declared range, which differs from the Apex page where a zero deferral silently becomes 24,500. Arithmetic over declared figures, not tax advice; plan rules vary and the plan document governs. The 2026 limits follow IRS Notice 2025-67, with the 49,000 double-limit cap from IRC 457(b)(3); the no 10 percent early-withdrawal-penalty remark on the Apex page is UNGROUNDED here.

- Page: https://ainumbers.co/chaingraph/art-849-deferred-comp-457b.html
- Markdown twin: https://ainumbers.co/chaingraph/art-849-deferred-comp-457b.md
- MCP tool: compute_deferred_comp_457b (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_income_usd (number, required): Annual W-2 income in USD, 0 to 1,000,000,000. Echoed only; no result depends on it.
- deferral_usd (number, required): Annual 457(b) deferral in USD, 0 to 49,000. Zero is a valid deferral. Above 24,500 the DEFERRAL_ABOVE_STANDARD_LIMIT flag is raised.
- current_rate_pct (number, required): Current marginal tax rate in percent, 0 to 60 (federal plus state combined as entered).
- retirement_rate_pct (number, required): Expected marginal tax rate on retirement withdrawals in percent, 0 to 60.
- years_to_retirement (integer, required): Whole years until retirement, 1 to 50.
- growth_rate_pct (number, required): Annual growth rate in percent, 0 to 20, applied to the 457(b) and used as the NPV discount rate.
- withdrawal_years (integer, required): Drawdown period in whole years, 5 to 40.
- taxable_return_pct (number, required): Annual return of the taxable account in percent, 0 to 20, net of dividend drag.
- capital_gains_rate_pct (number, required): Long-term capital gains rate in percent, 0 to 40, applied to the taxable account gain at liquidation.

## Outputs

- valid_input (boolean, optional)
- domain_errors (array, optional)
- inputs (object, optional)
- limits_used (object, optional)
- limit_tier (string,null, optional)
- scenario_a (object,null, optional)
- scenario_b (object,null, optional)
- advantage (object,null, optional)
- warnings (array, optional)
- note (string, optional)

## Sample

```json
{
  "annual_income_usd": 120000,
  "deferral_usd": 24500,
  "current_rate_pct": 24,
  "retirement_rate_pct": 20,
  "years_to_retirement": 20,
  "growth_rate_pct": 7,
  "withdrawal_years": 25,
  "taxable_return_pct": 6,
  "capital_gains_rate_pct": 15
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_deferred_comp_457b` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

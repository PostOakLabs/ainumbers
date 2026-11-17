# Caregiver Income Impact & Lost Earnings Estimator

Financial cost of unpaid caregiving: direct income loss during the care period, the retirement savings gap from missed 401(k) contributions plus their lost compounding, the cumulative cost of a post-care career setback, and a flagged Social Security reduction estimate, in integer USD cents. The SSA contribution and benefit base and the SSA average annual benefit are selected from a pinned vintage table by an explicit as_of date (the node reads no clock). Ported from ApexLogics display_number #117 (117-caregiver-income-impact, al_id AL-124, CC BY 4.0); DIFFERS-D1..D5 in the porting payload, three modelling constants UNGROUNDED.

- Page: https://ainumbers.co/chaingraph/art-761-caregiver-income-impact.html
- Markdown twin: https://ainumbers.co/chaingraph/art-761-caregiver-income-impact.md
- MCP tool: caregiver_income_impact (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, required): Vintage date, YYYY-MM-DD; the year selects the pinned SSA table and the node reads no clock.
- salary_usd (number, required): Current annual salary in USD, at least 0.
- current_age (number, required): Current age in years.
- retirement_age (number, required): Expected retirement age in years.
- care_years (number, required): Caregiving duration in years, at least 0.
- income_reduction_pct (number, required): Income reduction while caregiving, percent 0-100.
- career_setback_pct (number, required): Post-care salary setback, percent 0-100.
- contribution_401k_pct (number, required): Annual 401(k) contribution rate, percent 0-100.
- investment_return_pct (number, required): Annual investment return, percent -100 to 100.
- marginal_tax_rate_pct (number, required): Marginal tax rate percent 0-100; echoed, unused (DIFFERS-D4).
- ss_average_annual_benefit_usd (number, optional): Optional SSA average annual benefit override in USD; 23000 reproduces the Apex source.

## Sample

```json
{
  "as_of": "2026-10-13",
  "salary_usd": 90000,
  "current_age": 42,
  "retirement_age": 67,
  "care_years": 5,
  "income_reduction_pct": 50,
  "career_setback_pct": 10,
  "contribution_401k_pct": 6,
  "investment_return_pct": 7,
  "marginal_tax_rate_pct": 22
}
```

## Verify

Run the sample policy_parameters through MCP tool `caregiver_income_impact` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

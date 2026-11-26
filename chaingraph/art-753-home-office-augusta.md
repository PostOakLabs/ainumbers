# Home Office and Augusta Rule

Home-office deduction and IRC 280A(g) Augusta-rule rental exclusion calculator ported from ApexLogics Apex #139 (AL-146). From a square-footage and expense profile it computes the regular-method deduction, the Rev. Proc. 2013-13 simplified-method deduction ($5 per square foot, 300 square feet maximum), the better of the two, the day-count test for the 14-day rental exclusion, and the resulting tax benefits at the stated rates. Declared deviations from the source, all flagged: the gross-income cap applies to both methods; the simplified method is not selectable for an S-corp owner-employee (Rev. Proc. 2013-13 section 4.02); non-finite inputs are refused by name. Disclosed open legal question: IRC section 280A(g)(1) may bar the corporate rent deduction that the source books for an S corporation. The tool retains the source figure under a flag and does not decide the question. Verify-only: it reads no calendar, tests only the day count for section 280A(g), models no Form 8829, and is an estimate, not tax advice.

- Page: https://ainumbers.co/chaingraph/art-753-home-office-augusta.html
- Markdown twin: https://ainumbers.co/chaingraph/art-753-home-office-augusta.md
- MCP tool: calculate_home_office_augusta (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- office_sq_ft (number, required): Square feet of the home used for business. Blank or 0 falls back to 0.
- home_sq_ft (number, required): Total home square feet. Blank or 0 falls back to 1 to avoid dividing by zero.
- business_use_pct (number,null, required): Business-use percent, 0 to 100. Null auto-derives office_sq_ft / home_sq_ft; 0 overrides to 0%.
- annual_rent_usd (number, required): Annual rent or mortgage interest and taxes for the home, USD.
- utilities_usd (number, required): Annual utilities for the home, USD.
- other_home_expenses_usd (number, required): Other annual home expenses (insurance, repairs), USD. One undifferentiated bucket.
- gross_business_income_usd (number, required): Gross business income used for the gross-income cap, USD. Free-standing figure.
- entity_type_ho (string, required): Home-office filer: soleProp (Schedule C) or scorp (S-corp owner-employee, accountable plan).
- rental_days (number, required): Days the home is rented to the business. The day test passes at 14 or fewer.
- daily_rental_rate_usd (number, required): Fair-market daily rental rate charged to the business, USD.
- corp_tax_rate_pct (number, required): Rate valuing the corporate rent deduction, percent. 0 falls back to 37.
- entity_type_aug (string, required): Entity paying the rent: soleProp or scorp.
- owner_marginal_rate_pct (number, required): Owner marginal rate, percent. 0 falls back to 32.

## Outputs

- refusal_reason (string,null, required)
- office_sq_ft (number,null, required)
- home_sq_ft (number,null, required)
- business_use_fraction (number,null, required)
- gross_business_income_usd (number,null, required)
- entity_type_ho (string,null, required)
- rental_days (number,null, required)
- daily_rental_rate_usd (number,null, required)
- corp_tax_rate (number,null, required)
- owner_marginal_rate (number,null, required)
- entity_type_aug (string,null, required)
- total_home_expenses_usd (number,null, required)
- regular_deduction_before_gross_income_cap_usd (number,null, required)
- regular_deduction_usd (number,null, required)
- simplified_deduction_before_gross_income_cap_usd (number,null, required)
- simplified_deduction_usd (number,null, required)
- simplified_method_selectable (boolean,null, required)
- simplified_wins_on_amounts (boolean,null, required)
- best_home_office_deduction_usd (number,null, required)
- best_home_office_method (string,null, required)
- gross_income_cap_applied_to (string,null, required)
- total_rental_income_usd (number,null, required)
- qualifies_280a_g_day_test (boolean,null, required)
- augusta_tax_free_income_usd (number,null, required)
- augusta_corp_deduction_usd (number,null, required)
- augusta_tax_benefit_usd (number,null, required)
- augusta_tax_benefit_at_owner_rate_usd (number,null, required)
- home_office_tax_benefit_usd (number,null, required)
- combined_tax_benefit_usd (number,null, required)
- combined_tax_benefit_at_owner_rate_basis_usd (number,null, required)
- switches (object, required)
- fallback_fields (array, required)
- compliance_flags (array, required)
- warnings (array, required)
- notes (array, required)

## Sample

```json
{
  "office_sq_ft": 200,
  "home_sq_ft": 1800,
  "business_use_pct": null,
  "annual_rent_usd": 24000,
  "utilities_usd": 3600,
  "other_home_expenses_usd": 1200,
  "gross_business_income_usd": 120000,
  "entity_type_ho": "soleProp",
  "rental_days": 14,
  "daily_rental_rate_usd": 800,
  "corp_tax_rate_pct": 37,
  "entity_type_aug": "scorp",
  "owner_marginal_rate_pct": 32
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_home_office_augusta` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

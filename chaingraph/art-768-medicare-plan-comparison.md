# Medicare Plan Comparison

Medicare plan comparison ported from ApexLogics Apex #151 (AL-165). Prices two caller-declared Medicare enrollment paths for a full year, Path A (Original Medicare plus Medigap plus stand-alone Part D) and Path B (Medicare Advantage), for a typical year and a bad-year stress test on 2026 CMS parameters. Returns both totals, the annual and bad-year differences and both worst-case ceilings, or a named refusal. Verify-only: it does not quote plans or compare networks. Declared divergences from the ported page: the 2026 high-deductible Plan G deductible is the official $2,950 (the page carried $2,900 marked low confidence), reachable only as a declared constant override; negative, blank and non-numeric inputs are refused with a named reason instead of coerced to zero; the Advantage out-of-pocket limit above the 2026 in-network maximum of $9,250 is flagged and never clamped (payload DIFFERS.md D1-D12).

- Page: https://ainumbers.co/chaingraph/art-768-medicare-plan-comparison.html
- Markdown twin: https://ainumbers.co/chaingraph/art-768-medicare-plan-comparison.md
- MCP tool: compare_medicare_plans (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- irmaa_tier (integer, required)
- admissions_per_year (integer, required)
- primary_visits_per_year (integer, required)
- specialist_visits_per_year (integer, required)
- length_of_stay_days (integer, required)
- outpatient_charges_usd (number, required)
- annual_drug_cost_usd (number, required)
- medigap_premium_monthly_usd (number, required)
- medigap_plan_type (string, required)
- part_d_premium_monthly_usd (number, required)
- part_d_deductible_a_usd (number, required)
- ma_premium_monthly_usd (number, required)
- part_b_giveback_monthly_usd (number, required)
- ma_primary_copay_usd (number, required)
- ma_specialist_copay_usd (number, required)
- ma_inpatient_copay_per_day_usd (number, required)
- ma_inpatient_copay_days (integer, required)
- ma_outpatient_coinsurance_pct (number, required)
- ma_moop_usd (number, required)
- ma_drug_coverage_included (boolean, required)
- ma_plan_drug_deductible_usd (number, required)
- bad_year_admissions (integer, optional)
- bad_year_length_of_stay_days (integer, optional)
- bad_year_charge_multiplier (number, optional)
- part_b_premium_by_irmaa_tier_usd (array, optional)
- part_d_irmaa_surcharge_by_tier_usd (array, optional)
- part_b_deductible_usd (number, optional)
- part_a_deductible_usd (number, optional)
- part_a_days_61_to_90_coinsurance_usd (number, optional)
- part_a_lifetime_reserve_coinsurance_usd (number, optional)
- part_d_max_deductible_usd (number, optional)
- part_d_out_of_pocket_cap_usd (number, optional)
- plan_n_office_visit_copay_usd (number, optional)
- high_deductible_plan_g_deductible_usd (number, optional)

## Outputs

- data_vintage (string, optional)
- valid_input (boolean, optional)
- domain_errors (array, optional)
- medigap_plan_type (string,null, optional)
- irmaa_tier (integer,null, optional)
- typical_year (object,null, optional)
- bad_year (object,null, optional)
- bad_year_scenario (object,null, optional)
- comparison (object,null, optional)
- constants_used (object, optional)
- constant_overrides (array, optional)
- part_d_deductible_a_applied_usd (number, optional)
- part_d_deductible_a_clamped (boolean, optional)
- ma_plan_drug_deductible_applied_usd (number, optional)
- ma_plan_drug_deductible_clamped (boolean, optional)
- regulatory_basis (array, optional)
- rounding_mode (string, optional)
- scope_note (string, optional)
- cites (array, optional)

## Sample

```json
{
  "irmaa_tier": 0,
  "admissions_per_year": 0,
  "primary_visits_per_year": 4,
  "specialist_visits_per_year": 4,
  "length_of_stay_days": 4,
  "outpatient_charges_usd": 4000,
  "annual_drug_cost_usd": 2500,
  "medigap_premium_monthly_usd": 165,
  "medigap_plan_type": "PlanG",
  "part_d_premium_monthly_usd": 34.5,
  "part_d_deductible_a_usd": 615,
  "ma_premium_monthly_usd": 0,
  "part_b_giveback_monthly_usd": 0,
  "ma_primary_copay_usd": 10,
  "ma_specialist_copay_usd": 45,
  "ma_inpatient_copay_per_day_usd": 325,
  "ma_inpatient_copay_days": 5,
  "ma_outpatient_coinsurance_pct": 20,
  "ma_moop_usd": 5500,
  "ma_drug_coverage_included": true,
  "ma_plan_drug_deductible_usd": 615,
  "part_b_premium_by_irmaa_tier_usd": [
    202.9,
    284.1,
    405.8,
    527.5,
    649.2,
    689.9
  ],
  "part_d_irmaa_surcharge_by_tier_usd": [
    0,
    14.5,
    37.5,
    60.4,
    83.3,
    91
  ],
  "part_b_deductible_usd": 283,
  "part_a_deductible_usd": 1736,
  "part_a_days_61_to_90_coinsurance_usd": 434,
  "part_a_lifetime_reserve_coinsurance_usd": 868,
  "part_d_max_deductible_usd": 615,
  "part_d_out_of_pocket_cap_usd": 2100,
  "plan_n_office_visit_copay_usd": 20,
  "high_deductible_plan_g_deductible_usd": 2900,
  "bad_year_admissions": 2,
  "bad_year_length_of_stay_days": 7,
  "bad_year_charge_multiplier": 3
}
```

## Verify

Run the sample policy_parameters through MCP tool `compare_medicare_plans` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

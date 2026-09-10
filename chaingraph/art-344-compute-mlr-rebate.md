# MLR Rebate Calculator

Medical Loss Ratio numerator/denominator, credibility-adjustment tier, 3-year premium-weighted averaging, and rebate math per 45 CFR 158 (ACA MLR rule). Classifies member life-years into non-credible / partially-credible / fully-credible bands, computes the current-year adjusted MLR and the 3-year average against the market threshold (80% individual/small-group, 85% large-group), and applies the de minimis payment floor.

- Page: https://ainumbers.co/chaingraph/art-344-compute-mlr-rebate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-344-compute-mlr-rebate.md
- MCP tool: compute_mlr_rebate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- earned_premium (number, optional)
- federal_taxes_fees (number, optional)
- incurred_claims (number, optional)
- market (unknown, required)
- member_life_years (number, optional)
- prior_year_1_adjusted_mlr_pct (number, optional): Percentage value
- prior_year_1_earned_premium (number, optional)
- prior_year_2_adjusted_mlr_pct (number, optional): Percentage value
- prior_year_2_earned_premium (number, optional)
- quality_improvement_expenditures (number, optional)
- reinsurance_recoveries (number, optional)
- reporting_year (number, optional)
- risk_adjustment_net (number, optional)
- risk_corridors_net (number, optional)
- state_taxes_fees (number, optional)

## Outputs

- adjusted_earned_premium (integer, optional)
- adjusted_incurred_claims (integer, optional)
- constants_version (string, optional)
- credibility_adjustment_pct_points (integer, optional)
- credibility_tier (string, optional)
- current_year_adjusted_mlr_pct (number, optional)
- de_minimis (boolean, optional)
- market (string, optional)
- member_life_years (integer, optional)
- note (string, optional)
- raw_mlr_pct (number, optional)
- rebate_amount (integer, optional)
- rebate_owed (boolean, optional)
- rebate_pct_points (integer, optional)
- regulatory_basis (string, optional)
- reporting_year (integer, optional)
- three_yr_average_mlr_pct (number, optional)
- threshold_pct (integer, optional)
- years_included_in_average (integer, optional)

## Sample

```json
{
  "market": "large_group",
  "reporting_year": 2026,
  "earned_premium": 5000000,
  "federal_taxes_fees": 150000,
  "state_taxes_fees": 50000,
  "incurred_claims": 4200000,
  "quality_improvement_expenditures": 60000,
  "reinsurance_recoveries": 0,
  "risk_adjustment_net": 0,
  "risk_corridors_net": 0,
  "member_life_years": 100000,
  "prior_year_1_adjusted_mlr_pct": null,
  "prior_year_1_earned_premium": 0,
  "prior_year_2_adjusted_mlr_pct": null,
  "prior_year_2_earned_premium": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_mlr_rebate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

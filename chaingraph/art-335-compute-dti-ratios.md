# DTI Ratio Calculator

Front-end (housing) and back-end (total) debt-to-income ratios per Fannie Mae Selling Guide B3-6-02 and Freddie Mac Single-Family Seller/Servicer Guide 5401.2. Classifies the back-end ratio into a standard-manual / extended-manual-compensating-factors / DU-LPA-only / exceeds-max tier and flags whether the loan is within the max DTI for the selected underwriting type (DU, LPA, or manual). Feeds art-222-agency-eligibility-matrix as one of its DTI inputs. Not check_agency_eligibility_matrix itself, which performs the full multi-check eligibility decision.

- Page: https://ainumbers.co/chaingraph/art-335-compute-dti-ratios.html
- Markdown twin: https://ainumbers.co/chaingraph/art-335-compute-dti-ratios.md
- MCP tool: compute_dti_ratios (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- gross_monthly_income (number, optional)
- housing_payment_pitia (number, optional)
- other_monthly_debts (number, optional)
- underwriting_type (unknown, required)

## Outputs

- back_end_dti_pct (integer, optional)
- dti_tier (string, optional)
- front_end_dti_pct (number, optional)
- gross_monthly_income (integer, optional)
- housing_payment_pitia (integer, optional)
- max_dti_pct (integer, optional)
- note (string, optional)
- other_monthly_debts (integer, optional)
- regulatory_basis (string, optional)
- total_monthly_debt (integer, optional)
- underwriting_type (string, optional)
- within_max (boolean, optional)

## Sample

```json
{
  "gross_monthly_income": 8000,
  "housing_payment_pitia": 1800,
  "other_monthly_debts": 600,
  "underwriting_type": "du"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_dti_ratios` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

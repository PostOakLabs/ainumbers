# Check CARD Act Ability to Pay

Evaluates a credit card application against CARD Act §1026.51 ability-to-pay requirements. Computes monthly minimum payment from the requested credit limit and minimum payment percentage. Checks DTI against the 45% threshold using income and assets. Applies the under-21 independent-income restriction (§1026.51(b)). Reports the §1026.52(b) penalty fee safe harbor ($32 first violation / $43 subsequent). As observed 2026-09-01: the CFPB $8 late fee rule was vacated by consent judgment on 2025-04-15 (U.S. District Court, N.D. Tex., Chamber of Commerce v. CFPB, No. 4:24-cv-00213-P); $32/$43 thresholds remain in effect.

- Page: https://ainumbers.co/chaingraph/art-233-check-card-act-ability-to-pay.html
- Markdown twin: https://ainumbers.co/chaingraph/art-233-check-card-act-ability-to-pay.md
- MCP tool: check_card_act_ability_to_pay (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_income (number, optional)
- applicant_age (number, optional)
- has_cosigner (boolean, required)
- method (unknown, required)
- minimum_payment_pct (number, optional): Percentage value
- monthly_debt_obligations (number, optional)
- monthly_housing_payment (number, optional)
- requested_credit_limit (number, optional)
- total_assets (number, optional)

## Outputs

- ability_to_pay_result (string, optional)
- annual_income (integer, optional)
- annual_minimum_payments_est (integer, optional)
- dti_ratio (integer, optional)
- dti_threshold (number, optional)
- has_cosigner (boolean, optional)
- income_and_assets (integer, optional)
- method_a_sufficient (boolean, optional)
- method_b_sufficient (boolean, optional)
- method_used (string, optional)
- monthly_debt_obligations (integer, optional)
- monthly_housing_payment (integer, optional)
- monthly_income (integer, optional)
- monthly_minimum_payment_est (integer, optional)
- penalty_fee_safe_harbor (object, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- requested_credit_limit (integer, optional)
- requires_cosigner (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_assets (integer, optional)
- total_monthly_obligations (integer, optional)
- under_21_restriction (boolean, optional)

## Sample

```json
{
  "applicant_age": 19,
  "annual_income": 0,
  "total_assets": 0,
  "requested_credit_limit": 1000,
  "has_cosigner": false,
  "method": "income_assets"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_card_act_ability_to_pay` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

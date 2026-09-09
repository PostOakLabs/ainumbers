# VA Funding Fee and Residual Income

VA home loan funding fee (38 USC §3729) and residual income qualification. Funding fee table: first vs subsequent use, down-payment tiers (0%/5-9.99%/10%+), exemptions for service-connected disability/surviving spouse/Purple Heart. IRRRL: 0.50%. Residual income: VA Pamphlet 26-7 Ch.4 Tables 41A/41B by region (Northeast/Midwest/South/West) and family size; $80 per member above five. DTI benchmark: 41% (triggers residual income review when exceeded). Table versions: VA-FF-2025-01-01 (VA Circular 26-25-3); VA-PAMPHLET-26-7-CH4-2024.

- Page: https://ainumbers.co/chaingraph/art-225-va-funding-fee-residual.html
- Markdown twin: https://ainumbers.co/chaingraph/art-225-va-funding-fee-residual.md
- MCP tool: compute_va_funding_fee_residual (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- base_loan_amount (number, optional)
- down_payment_pct (number, optional): Percentage value
- dti_pct (number, optional): Percentage value
- family_size (number, optional)
- funding_fee_exempt (boolean, required)
- gross_monthly_income (number, optional)
- loan_purpose (unknown, required)
- monthly_shelter_expenses (number, optional)
- state (unknown, required)
- va_use_type (unknown, required)

## Outputs

- dti (object, optional)
- funding_fee (object, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- residual_income (object, optional)
- table_source_funding_fee (string, optional)
- table_source_residual (string, optional)
- table_version_funding_fee (string, optional)
- table_version_residual (string, optional)

## Sample

```json
{
  "base_loan_amount": 300000,
  "down_payment_pct": 0,
  "loan_purpose": "purchase",
  "va_use_type": "first",
  "family_size": 2,
  "state": "TX",
  "dti_pct": 35,
  "gross_monthly_income": 6000,
  "monthly_shelter_expenses": 2000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_va_funding_fee_residual` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

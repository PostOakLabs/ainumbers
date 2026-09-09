# FHA MIP Eligibility Calculator

FHA mortgage insurance premium (MIP) eligibility and cost calculator per HUD Handbook 4000.1. UFMIP: 1.75% of base loan. Annual MIP grid (0.15%-0.75%) by base loan amount vs $726,200 threshold, LTV, and term. MIP duration: 11 years when original LTV at or below 90%; life-of-loan when above 90%. Qualifying ratios: 31% front-end / 43% back-end (compensating factors to 40%/57%). Credit score floors: 580 for 96.5% LTV; 500-579 for 90% max. Table version: HUD-MIP-ML2023-05-ML2024-01 (HUD Mortgagee Letter 2023-05, effective 2023-03-20).

- Page: https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.html
- Markdown twin: https://ainumbers.co/chaingraph/art-224-fha-mip-eligibility.md
- MCP tool: compute_fha_mip_eligibility (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- back_end_dti_pct (number, optional): Percentage value
- base_loan_amount (number, optional)
- fico_score (number, optional)
- front_end_dti_pct (number, optional): Percentage value
- loan_purpose (unknown, required)
- ltv_pct (number, optional): Percentage value
- term_years (number, optional)

## Outputs

- annual_mip (object, optional)
- dti (object, optional)
- fha_eligible (boolean, optional)
- fico_eligible (boolean, optional)
- ltv_eligible (boolean, optional)
- max_ltv_pct (number, optional)
- note (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- ufmip (object, optional)

## Sample

```json
{
  "base_loan_amount": 300000,
  "ltv_pct": 96.5,
  "term_years": 30,
  "fico_score": 620,
  "front_end_dti_pct": 30,
  "back_end_dti_pct": 42,
  "loan_purpose": "purchase"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_fha_mip_eligibility` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

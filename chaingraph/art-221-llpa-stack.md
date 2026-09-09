# LLPA Stack Calculator

Fannie Mae public LLPA (Loan-Level Price Adjustment) matrix calculator. FICO-by-LTV base grid plus feature surcharges: cash-out refinance, second home, investment property, warrantable condo, subordinate financing. Applies FTHB AMI waiver (SEL-2023-07, up to 1.75 pp reduction for first-time buyers at or below 100% AMI). Table version: FNM-LLPA-2025-11-01 (Fannie Mae public publication). Not check_agency_eligibility_matrix (DU/LPA approval grid) or check_conforming_loan_limit (FHFA size limits).

- Page: https://ainumbers.co/chaingraph/art-221-llpa-stack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-221-llpa-stack.md
- MCP tool: compute_llpa_stack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- ami_pct (number, optional): Percentage value
- fico_score (number, optional)
- first_time_buyer (boolean, required)
- loan_purpose (unknown, required)
- ltv_pct (number, optional): Percentage value
- occupancy_type (unknown, required)
- property_type (unknown, required)
- subordinate_financing (boolean, required)

## Outputs

- base_llpa (integer, optional)
- components (array, optional)
- feature_llpa (integer, optional)
- fico_band (string, optional)
- fthb_eligible (boolean, optional)
- fthb_waiver (integer, optional)
- ltv_band (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_llpa_pct (integer, optional)

## Sample

```json
{
  "fico_score": 780,
  "ltv_pct": 60,
  "loan_purpose": "purchase",
  "occupancy_type": "primary",
  "property_type": "sfr"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_llpa_stack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

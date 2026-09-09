# Agency Eligibility Matrix

Fannie Mae DU and Freddie Mac LPA agency eligibility matrix. Checks DTI caps (DU/LPA: 50%; manual UW: 36% housing / 45% total), LTV/CLTV/HCLTV maximums by occupancy type (primary/second home/investment) and loan purpose (purchase/rate-term/cash-out), and multi-unit property constraints. Returns eligible_flag (ELIGIBLE or INELIGIBLE) and detailed per-check results. Table version: FNM-LPA-ELIGIBILITY-2026-01-01. Not compute_llpa_stack (LLPA pricing surcharges) or check_conforming_loan_limit (FHFA loan size limits).

- Page: https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.html
- Markdown twin: https://ainumbers.co/chaingraph/art-222-agency-eligibility-matrix.md
- MCP tool: check_agency_eligibility_matrix (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cltv_pct (number, required): Percentage value
- dti_pct (number, optional): Percentage value
- fico_score (number, optional)
- hcltv_pct (number, required): Percentage value
- housing_dti_pct (number, required): Percentage value
- loan_purpose (unknown, required)
- ltv_pct (number, optional): Percentage value
- occupancy_type (unknown, required)
- property_type (unknown, required)
- underwriting_type (unknown, required)
- units (number, optional)

## Outputs

- checks (array, optional)
- eligible (boolean, optional)
- eligible_flag (string, optional)
- fails (array, optional)
- max_cltv_pct (integer, optional)
- max_dti_pct (integer, optional)
- max_hcltv_pct (integer, optional)
- max_ltv_pct (integer, optional)
- pii_note (string, optional)
- product_notes (array, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- underwriting_type (string, optional)

## Sample

```json
{
  "fico_score": 740,
  "ltv_pct": 80,
  "dti_pct": 40,
  "occupancy_type": "primary",
  "property_type": "sfr",
  "loan_purpose": "purchase",
  "underwriting_type": "du",
  "units": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_agency_eligibility_matrix` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

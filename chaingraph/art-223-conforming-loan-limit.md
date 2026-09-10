# Conforming Loan Limit Check

FHFA annual conforming loan limit classifier. 2026 baseline: $832,750 (1-unit), $1,066,250 (2-unit), $1,288,800 (3-unit), $1,601,750 (4-unit). High-cost areas carry a ceiling at 150% of baseline; AK, HI, Guam and USVI receive a statutory uplift that raises their baseline to the same figure. Classifies a loan as conforming, super-conforming (the Enterprise high-balance category, above the area baseline and at or below the applicable high-cost limit) or jumbo. Fails closed with a null verdict and a named flag on an unsupported year or a missing loan amount. Accepts an optional county-level limit override from the FHFA full county loan limit list. Table version: FHFA-CLL-2026. Not lookup_reg_z_thresholds (Reg Z consumer-protection dollar thresholds) or check_agency_eligibility_matrix (DU/LPA approval parameters).

- Page: https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.html
- Markdown twin: https://ainumbers.co/chaingraph/art-223-conforming-loan-limit.md
- MCP tool: check_conforming_loan_limit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- county_limit_override (number, optional)
- high_cost_county (boolean, required)
- loan_amount (number, optional)
- loan_program (unknown, required)
- state (unknown, required)
- units (number, optional)
- year (number, required)

## Outputs

- applicable_limit (integer, optional)
- area_baseline (integer, optional)
- baseline_limit (integer, optional)
- classification (string, optional)
- conforming (boolean, optional)
- high_cost_ceiling (integer, optional)
- is_ak_hi_territory (boolean, optional)
- jumbo (boolean, optional)
- limit_tier (string, optional)
- loan_amount (integer, optional)
- loan_program (string, optional)
- note (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- state_code (string, optional)
- super_conforming (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- units (integer, optional)
- year (integer, optional)

## Sample

```json
{
  "loan_amount": 700000,
  "units": 1,
  "year": 2026,
  "loan_program": "VA"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_conforming_loan_limit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

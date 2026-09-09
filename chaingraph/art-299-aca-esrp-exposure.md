# ACA Employer Shared Responsibility Payment Exposure Calculator

Compute proposed IRC 4980H(a) ("no offer to 95%") and 4980H(b) ("unaffordable / not minimum value") Employer Shared Responsibility Payment exposure from supplied full-time-employee counts, minimum-essential-coverage offer counts, and PTC-triggering employee counts, using the version-pinned 2026 per-employee penalty amounts ($3,340 (a) / $5,010 (b) annual, IRS Rev. Proc. 2025-26). Returns the controlling penalty and monthly breakdown. Exposure math only, not a determination that an assessment is owed. Feeds the terminal aca-226j-response-composer receipt. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-299-aca-esrp-exposure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-299-aca-esrp-exposure.md
- MCP tool: compute_esrp_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fulltime_count (unknown, required): Count
- offered_mec_count (unknown, required): Count
- ptc_employee_count (unknown, required): Count
- tax_year (unknown, required)

## Outputs

- a_applicable (boolean, optional)
- a_exposure_annual (integer, optional)
- a_monthly_per_employee (number, optional)
- b_applicable (boolean, optional)
- b_exposure_annual (integer, optional)
- b_monthly_per_employee (number, optional)
- controlling_exposure_annual (integer, optional)
- controlling_penalty (string, optional)
- coverage_offer_rate (number, optional)
- error (string, optional)
- offer_rate_threshold (number, optional)
- tax_year (string, optional)

## Sample

```json
{
  "tax_year": "2026",
  "fulltime_count": 200,
  "offered_mec_count": 150,
  "ptc_employee_count": 5
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_esrp_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

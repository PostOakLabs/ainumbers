# Gross-to-Net Payroll Calculator (FICA)

Gross-to-net payroll calculation: FICA (Social Security 6.2% up to the OASDI contribution and benefit base for the selected tax year, Medicare 1.45% uncapped, Additional Medicare Tax 0.9% on cumulative wages over $200,000 per IRC 3101(b)(2)), pretax deduction ordering (401(k)/HSA/Section 125 reduce both FICA and federal-taxable wages), and net pay. tax_year is a required input and selects the wage base: $184,500 for 2026 and $176,100 for 2025, with an absent or unsupported year failing closed with error unsupported_or_missing_tax_year rather than defaulting. The Social Security and Medicare rates and the $200,000 Additional Medicare threshold are statutory and not indexed, so they are not year-keyed. federal_withholding_per_period is a declared input, normally fed from art-338-compute-federal-withholding's output at the same tax_year, since kernels cannot import one another. Federal only, not tax advice, state withholding and state payroll taxes out of scope. Consumes art-338-compute-federal-withholding. Not compute_federal_withholding itself, which only computes the federal income tax withholding line.

- Page: https://ainumbers.co/chaingraph/art-339-compute-gross-to-net.html
- Markdown twin: https://ainumbers.co/chaingraph/art-339-compute-gross-to-net.md
- MCP tool: compute_gross_to_net (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- federal_withholding_per_period (number, optional)
- gross_wages_per_period (number, optional)
- post_tax_other_deductions (number, optional)
- pretax_reduces_fica_and_fit (number, optional)
- tax_year (unknown, required)
- ytd_fica_wages_before_period (number, optional)

## Outputs

- additional_medicare_tax (integer, optional)
- additional_medicare_threshold (integer, optional)
- additional_medicare_wages_this_period (integer, optional)
- constants_version (string, optional)
- error (string, optional)
- federal_withholding_per_period (integer, optional)
- fica_tax_total (number, optional)
- fica_wages_this_period (integer, optional)
- medicare_tax (number, optional)
- net_pay (number, optional)
- note (string, optional)
- post_tax_other_deductions (integer, optional)
- pretax_reduces_fica_and_fit (integer, optional)
- regulatory_basis (string, optional)
- social_security_tax (integer, optional)
- ss_taxable_wages_this_period (integer, optional)
- ss_wage_base (integer, optional)
- supported_tax_years (array, optional)
- tax_year (string, optional)
- ytd_fica_wages_after_period (integer, optional)

## Sample

```json
{
  "tax_year": "2026",
  "gross_wages_per_period": 5000,
  "federal_withholding_per_period": 0,
  "pretax_reduces_fica_and_fit": 0,
  "post_tax_other_deductions": 0,
  "ytd_fica_wages_before_period": 180000
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_gross_to_net` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

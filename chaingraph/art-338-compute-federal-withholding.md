# Federal Withholding Calculator (Percentage Method)

Federal income tax withholding via the IRS Publication 15-T percentage method, Worksheet 1A, for a 2020-or-later Form W-4. tax_year is a required input and selects the edition: the 2026 Section 1 and 2025 Section 4 STANDARD Withholding Rate Schedules are both carried, and an absent or unsupported year fails closed with error unsupported_or_missing_tax_year rather than defaulting to an edition the caller never chose. Supports single/MFS, married filing jointly, and head of household, plus Step 3 dependents credit, Step 4(a) other income, Step 4(b) deductions, and Step 4(c) extra withholding. STANDARD Withholding Rate Schedules only; the Form W-4 Step 2 multiple-jobs checkbox table is out of scope. Federal only, not tax advice, state withholding out of scope. Feeds art-339-compute-gross-to-net as its federal_withholding_per_period input, which must be called with the same tax_year. Not compute_gross_to_net itself, which computes FICA and net pay.

- Page: https://ainumbers.co/chaingraph/art-338-compute-federal-withholding.html
- Markdown twin: https://ainumbers.co/chaingraph/art-338-compute-federal-withholding.md
- MCP tool: compute_federal_withholding (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- filing_status (unknown, required)
- gross_wages_per_period (number, optional)
- pay_frequency (unknown, required)
- step3_dependents_credit_annual (number, optional)
- step4a_other_income_annual (number, optional)
- step4b_deductions_annual (number, optional)
- step4c_extra_withholding_per_period (number, optional)
- tax_year (unknown, required)

## Outputs

- adjusted_annual_wage_amount (integer, optional)
- bracket_at_least (integer, optional)
- bracket_rate (number, optional)
- constants_version (string, optional)
- error (string, optional)
- federal_withholding_per_period (number, optional)
- filing_status (string, optional)
- note (string, optional)
- pay_frequency (string, optional)
- periods_per_year (integer, optional)
- regulatory_basis (string, optional)
- step3_credit_this_period (integer, optional)
- step4c_extra_withholding_per_period (integer, optional)
- supported_tax_years (array, optional)
- tax_year (string, optional)
- tentative_annual_withholding (integer, optional)
- tentative_withholding_this_period (number, optional)

## Sample

```json
{
  "tax_year": "2026",
  "gross_wages_per_period": 2000,
  "pay_frequency": "biweekly",
  "filing_status": "single_or_mfs"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_federal_withholding` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

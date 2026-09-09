# DSCR & Interest Coverage Ratio Calculator

Debt Service Coverage Ratio and Interest Coverage Ratio suite: Basic/Cash/FCF DSCR, Fixed Charge Coverage Ratio (FCCR), EBIT- and EBITDA-basis ICR, and Net/Gross Leverage, evaluated against a published lender threshold matrix (investment grade, leveraged loan, CRE, infrastructure, SME/mid-market). Provable node counterpart to tools/438-dscr-interest-coverage-calculator.html.

- Page: https://ainumbers.co/chaingraph/art-363-compute-dscr.html
- Markdown twin: https://ainumbers.co/chaingraph/art-363-compute-dscr.md
- MCP tool: compute_dscr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amortization_musd (number, optional)
- capex_musd (number, optional)
- cash_musd (number, optional)
- ebit_musd (number, optional)
- ebitda_musd (number, optional)
- interest_musd (number, optional)
- leases_musd (number, optional)
- principal_musd (number, optional)
- revolver_draw_musd (number, optional)
- taxes_musd (number, optional)
- total_debt_musd (number, optional)
- working_capital_change_musd (number, optional)

## Outputs

- basic_dscr (number, optional)
- cash_dscr (number, optional)
- fccr (number, optional)
- fcf_dscr (number, optional)
- gross_leverage (number, optional)
- icr_ebit_basis (number, optional)
- icr_ebitda_basis (integer, optional)
- lender_assessment (array, optional)
- net_leverage (number, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- total_debt_service_musd (integer, optional)

## Sample

```json
{
  "ebitda_musd": 30,
  "ebit_musd": 22,
  "interest_musd": 6,
  "principal_musd": 5,
  "leases_musd": 2,
  "capex_musd": 6,
  "taxes_musd": 5,
  "working_capital_change_musd": 1.5,
  "amortization_musd": 5,
  "revolver_draw_musd": 0,
  "total_debt_musd": 80,
  "cash_musd": 12
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_dscr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

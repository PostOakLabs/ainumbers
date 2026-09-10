# Reg Z Appendix J APR Solver

Reg Z Appendix J actuarial APR solver. Bracketed bisection on the general actuarial equation (12 CFR 1026 Appendix J), with the odd-days fraction priced at simple interest per (b)(6) and only full unit-periods compounded. Handles regular and irregular payment schedules with an odd-days fractional first period, and reports a rate only when a sign-change bracket was established. Pure ECMA-262 arithmetic, no floating-point built-ins beyond basic operations. APR accuracy, TRID disclosure, and QM spread test input.

- Page: https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.html
- Markdown twin: https://ainumbers.co/chaingraph/art-215-reg-z-appendix-j-apr.md
- MCP tool: compute_reg_z_appendix_j_apr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- advances (array, required)
- loan_amount (number, optional)
- num_payments (number, optional)
- odd_days (number, optional): Duration in days
- payment_amount (number, optional)
- payments (array, required)
- periods_per_year (number, optional)
- unit_period_days (number, optional): Duration in days

## Outputs

- advance_total (integer, optional)
- apr_pct (number, optional)
- bracketed (boolean, optional)
- converged (boolean, optional)
- finance_charge (number, optional)
- iterations (integer, optional)
- note (string, optional)
- num_payments (integer, optional)
- payment_total (number, optional)
- periodic_rate (number, optional)
- periods_per_year (integer, optional)
- regulatory_basis (string, optional)

## Sample

```json
{
  "loan_amount": 6000,
  "payment_amount": 282.43,
  "num_payments": 24,
  "periods_per_year": 12
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_reg_z_appendix_j_apr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

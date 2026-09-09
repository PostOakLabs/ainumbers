# CCD2 Annex III APRC Recompute

Recomputes the EU Directive (EU) 2023/2225 (CCD2) annual percentage rate of charge (APRC) from a caller-supplied drawdown/repayment schedule against Annex III Part I's own present-value-equality equation, solved iteratively by bracketed bisection for the rate X. Unlike Reg Z Appendix J (art-215), Annex III's own text expresses each flow's interval directly in years and fractions of a year and raises (1+X) to that real-valued power with no integer/fraction split, so this kernel uses genuine fractional exponentiation. A rate is reported only when a sign-change bracket was established and narrowed to a declared tolerance; non-convergence and a non-bracketed schedule are both reported honestly (converged:false, bracketed:false, aprc_pct:null), never silently returned as a guess. The result is expressed to at least one decimal place per Annex III Part I remark (d), rounded half-up on the next digit. Architecturally class-C shaped (unbounded schedule arrays, iterative solver) and assigned class-B property-testing rigor by this row's own explicit ruling, not because the input domain is bounded. Verify-only recompute: does not determine which CCD2-covered agreements a caller's product falls under, does not submit anything to a regulator, and does not assert that a real agreement is or is not CCD2-compliant.

- Page: https://ainumbers.co/chaingraph/art-619-ccd2-aprc-annex3-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-619-ccd2-aprc-annex3-recompute.md
- MCP tool: recompute_ccd2_aprc_annex3 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- drawdowns (array, required): Array of {amount, full_periods, fraction} or {amount, t_years}
- repayments (array, required): Array of {amount, full_periods, fraction} or {amount, t_years}

## Outputs

- aprc_pct (number,null, optional)
- converged (boolean, optional)
- bracketed (boolean, optional)
- iterations_used (number, optional)
- residual_at_convergence (number,null, optional)
- num_drawdowns (number, optional)
- num_repayments (number, optional)
- drawdown_total (number, optional)
- repayment_total (number, optional)
- total_charge (number, optional)

## Sample

```json
{
  "drawdowns": [
    {
      "amount": 1000,
      "full_periods": 0,
      "fraction": 0
    }
  ],
  "repayments": [
    {
      "amount": 1100,
      "full_periods": 1,
      "fraction": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_ccd2_aprc_annex3` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

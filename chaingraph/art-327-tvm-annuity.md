# Annuity PV / FV / Payment Solver

Solves present value, future value, or payment for an ordinary annuity or annuity-due, given the other two plus rate and number of periods, using the standard closed-form annuity factor. Matches Excel PV/FV/PMT semantics including the due=true (beginning-of-period) adjustment.

- Page: https://ainumbers.co/chaingraph/art-327-tvm-annuity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-327-tvm-annuity.md
- MCP tool: compute_annuity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- due (boolean, required)
- fv (number, optional)
- nper (number, optional)
- pmt (number, optional)
- pv (number, optional)
- rate_pct (number, optional): Percentage value
- solve_for (string, required)

## Outputs

- annuity_factor (number, optional)
- due (boolean, optional)
- fv (integer, optional)
- note (string, optional)
- nper (integer, optional)
- pmt (integer, optional)
- pv (number, optional)
- rate_pct (number, optional)
- regulatory_basis (string, optional)
- solved_for (string, optional)

## Sample

```json
{
  "rate_pct": 0.6666666666666667,
  "nper": 24,
  "pmt": -100,
  "fv": 0,
  "solve_for": "pv"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_annuity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

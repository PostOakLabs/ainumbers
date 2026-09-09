# Internal Rate of Return (IRR)

Internal rate of return for an equal-period cash flow series, solved by deterministic bisection over a declared rate bracket with declared tolerance and iteration cap. Never Newton/derivative-based, so no float-drift nondeterminism. Reports whether the bracket contained a sign change and whether the search converged.

- Page: https://ainumbers.co/chaingraph/art-325-tvm-irr.html
- Markdown twin: https://ainumbers.co/chaingraph/art-325-tvm-irr.md
- MCP tool: compute_irr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bracket_hi (number, optional)
- bracket_lo (number, optional)
- cash_flows (array, required)
- max_iterations (number, optional)
- tolerance (number, required)

## Outputs

- bracket_hi_pct (integer, optional)
- bracket_lo_pct (number, optional)
- converged (boolean, optional)
- irr_pct (number, optional)
- iterations (integer, optional)
- method (string, optional)
- note (string, optional)
- num_cash_flows (integer, optional)
- regulatory_basis (string, optional)
- tolerance (number, optional)

## Sample

```json
{
  "cash_flows": [
    {
      "amount": -1000
    },
    {
      "amount": 500
    },
    {
      "amount": 400
    },
    {
      "amount": 300
    },
    {
      "amount": 100
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_irr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

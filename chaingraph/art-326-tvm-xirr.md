# XIRR (Irregular Dated Cash Flows)

Annualized rate of return for irregular-interval dated cash flows, matching Excel XIRR semantics exactly: fixed actual/365 day count, anchored to the first cash flow date, solved by deterministic bisection over a declared rate bracket. Companion to compute_irr for cash flows that do not fall on equal periods.

- Page: https://ainumbers.co/chaingraph/art-326-tvm-xirr.html
- Markdown twin: https://ainumbers.co/chaingraph/art-326-tvm-xirr.md
- MCP tool: compute_xirr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- bracket_hi (number, optional)
- bracket_lo (number, optional)
- cash_flows (array, required)
- max_iterations (number, optional)
- tolerance (number, required)

## Outputs

- anchor_date (string, optional)
- bracket_hi_pct (integer, optional)
- bracket_lo_pct (number, optional)
- converged (boolean, optional)
- day_count_convention (string, optional)
- iterations (integer, optional)
- method (string, optional)
- note (string, optional)
- num_cash_flows (integer, optional)
- regulatory_basis (string, optional)
- tolerance (number, optional)
- xirr_pct (number, optional)

## Sample

```json
{
  "cash_flows": [
    {
      "amount": -10000,
      "date": "2008-01-01"
    },
    {
      "amount": 2750,
      "date": "2008-03-01"
    },
    {
      "amount": 4250,
      "date": "2008-10-30"
    },
    {
      "amount": 3250,
      "date": "2009-02-15"
    },
    {
      "amount": 2750,
      "date": "2009-04-01"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_xirr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

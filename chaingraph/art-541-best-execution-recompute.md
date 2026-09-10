# Best-Execution NBBO Recompute

Recomputes, per supplied fill, price improvement in basis points against the NBBO at time of execution - price_improvement_bps = (nbbo_ask - execution_price) / nbbo_ask * 10000 for buys, (execution_price - nbbo_bid) / nbbo_bid * 10000 for sells - and whether each fill cleared at-or-better than the NBBO. Aggregates pct_at_or_better, avg_price_improvement_bps, and fill_count over a bounded fill set (capped at 5,000 fills). No customer/order identifiers accepted. Reg NMS best-execution obligations and FINRA Rule 5310 are the US crosswalk entry; the core recompute is the generic shape any best-execution regime ultimately checks. Attests the computation over caller-supplied inputs only, not an audit of those inputs or a determination of regulatory compliance.

- Page: https://ainumbers.co/chaingraph/art-541-best-execution-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-541-best-execution-recompute.md
- MCP tool: recompute_best_execution (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fills (unknown, required)

## Outputs

- fills (array, optional)
- fill_count (integer, optional)
- scored_count (integer, optional)
- rejected_count (integer, optional)
- pct_at_or_better (number,null, optional)
- avg_price_improvement_bps (number,null, optional)
- fill_set_ceiling (integer, optional)
- fill_set_truncated (boolean, optional)
- rules_version (string, optional)
- regulatory_basis (string, optional)
- note (string, optional)

## Sample

```json
{
  "fills": [
    {
      "side": "buy",
      "execution_price": 10.02,
      "nbbo_bid": 10,
      "nbbo_ask": 10.05,
      "quantity": 100
    },
    {
      "side": "sell",
      "execution_price": 10.03,
      "nbbo_bid": 10,
      "nbbo_ask": 10.05,
      "quantity": 200
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_best_execution` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

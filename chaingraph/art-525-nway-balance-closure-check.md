# N-Way Balance Closure Check

Takes three or more caller-declared balances for the same measure, at the same as-of moment, across named internal systems, and ENFORCES the arithmetic closure identity (A minus B) plus (B minus C) equals (A minus C) within a caller-declared tolerance. Reports every pairwise difference, the closure residual for every triple, which pair carries the break, and which system is the single consistent explanation for all breaking pairs. This is not a fourth balance display: three pairwise tables enforce nothing across each other, because the third difference is fully determined by the other two, and the residual is the test a dashboard leaves to a human. Where a firm already reconciles hop by hop, each hop's own reconciled difference can be declared as an independent input, and the node then checks that those hops close against each other and agree with the declared balances. Tolerance is always a declared input, never defaulted, since an unstated tolerance turns every rounding difference into a break. Residual within tolerance yields auto_pass; outside tolerance, or a pairwise break, or a declared hop that disagrees with the balances, yields review_required, which routes to an exception step and never blocks. Balances at differing or undeclared as-of moments yield a ran-stale execution state; fewer than three systems, an undeclared tolerance, or no designated authoritative system yields a did-not-run execution state rather than a degraded pass. Balances, hop differences and the tolerance are integer minor units, so the arithmetic is exact. Scoped to internal system-boundary hops inside one firm, ahead of any filing. Clause: BCBS 239 Principle 2 fn.16 (robust automated reconciliation where multiple systems are in use); BCBS 239 SS36(d) (reconcile to a designated authoritative source, never consumer to consumer).

- Page: https://ainumbers.co/chaingraph/art-525-nway-balance-closure-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-525-nway-balance-closure-check.md
- MCP tool: check_nway_balance_closure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- authoritative_system_id (unknown, required)
- closure_tolerance_minor (unknown, required)
- declared_differences (array, required)
- measure_label (unknown, required)
- systems (array, required)

## Outputs

- decision (object, optional)
- measure_label (string, optional)
- authoritative_system_id (string, optional)
- closure_tolerance_minor (integer, optional)
- system_count (integer, optional)
- as_of_consistent (boolean, optional)
- as_of_values (array, optional)
- systems (array, optional)
- pairwise (array, optional)
- triples (array, optional)
- triple_count (integer, optional)
- closure_holds (boolean, optional)
- max_abs_residual_minor (integer, optional)
- break_pairs (array, optional)
- declared_disagreements (array, optional)
- suspect_systems (array, optional)
- rejected_inputs (array, optional)
- scope_note (string, optional)
- boundary_note (string, optional)

## Sample

```json
{
  "measure_label": "Total customer deposits, USD",
  "authoritative_system_id": "CORE-DDA",
  "closure_tolerance_minor": 100,
  "systems": [
    {
      "system_id": "CORE-DDA",
      "balance_minor": 212800400000,
      "as_of": "2026-06-30T23:59:59Z"
    },
    {
      "system_id": "GL-ORACLE",
      "balance_minor": 212800400000,
      "as_of": "2026-06-30T23:59:59Z"
    },
    {
      "system_id": "REG-MART",
      "balance_minor": 212800400000,
      "as_of": "2026-06-30T23:59:59Z"
    }
  ],
  "declared_differences": [
    {
      "from_system_id": "CORE-DDA",
      "to_system_id": "GL-ORACLE",
      "difference_minor": 0
    },
    {
      "from_system_id": "GL-ORACLE",
      "to_system_id": "REG-MART",
      "difference_minor": 0
    },
    {
      "from_system_id": "CORE-DDA",
      "to_system_id": "REG-MART",
      "difference_minor": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_nway_balance_closure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

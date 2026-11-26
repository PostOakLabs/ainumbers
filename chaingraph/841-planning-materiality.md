# Planning Materiality

Arithmetic on declared policy. It does not choose the benchmark, does not judge whether the percentage is appropriate, and is not a materiality determination. From a declared benchmark id, a benchmark amount in integer minor units, an overall percentage in basis points, a performance percentage of overall in basis points, a clearly-trivial percentage of overall in basis points, a required rationale id and a declared rounding rule (round half up or floor), it recomputes the overall materiality, the performance materiality and the clearly-trivial threshold, and reports whether performance stays at or below overall and clearly-trivial stays at or below performance (a violation is flagged, never corrected). It ships no default percentage and no typical range. A missing rationale id or benchmark id, a percentage of zero or above 10000 basis points, a negative or non-integer amount, or an unknown rounding rule is refused with an explicit code. The performance threshold is the tolerable-misstatement figure that the attribute and monetary-unit sampling node (art-693) takes as an input. The planning standards (ISA 320, AS 2105) are cited for context and never reproduced. No randomness and no clock. Values only, no personal data.

- Page: https://ainumbers.co/chaingraph/841-planning-materiality.html
- Markdown twin: https://ainumbers.co/chaingraph/841-planning-materiality.md
- MCP tool: compute_planning_materiality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- benchmark_id (string, required): Declared id of the benchmark the amount comes from (not free text)
- benchmark_amount (integer, required): Benchmark amount in integer minor units; zero or more
- overall_bps (integer, required): Overall materiality as basis points of the benchmark; 1 to 10000
- performance_bps (integer, required): Performance materiality as basis points of overall; 1 to 10000
- trivial_bps (integer, required): Clearly-trivial threshold as basis points of overall; 1 to 10000
- rationale_id (string, required): Required id of the documented rationale for the benchmark and percentages
- rounding_rule (string, required): Declared rounding rule, half_up or floor; it changes the hash

## Outputs

- outcome (string, optional)
- refusal_reasons (array, optional)
- benchmark_id (string,null, optional)
- rationale_id (string,null, optional)
- rounding_rule (string,null, optional)
- benchmark_amount (integer,null, optional)
- overall_bps (integer,null, optional)
- performance_bps (integer,null, optional)
- trivial_bps (integer,null, optional)
- overall_materiality (integer,null, optional)
- performance_materiality (integer,null, optional)
- clearly_trivial_threshold (integer,null, optional)
- performance_not_above_overall (boolean,null, optional)
- trivial_not_above_performance (boolean,null, optional)
- warnings (array, optional)

## Sample

```json
{
  "benchmark_id": "bm-profit-before-tax",
  "benchmark_amount": 1234567891,
  "overall_bps": 500,
  "performance_bps": 7500,
  "trivial_bps": 500,
  "rationale_id": "rat-synthetic-001",
  "rounding_rule": "half_up"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_planning_materiality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

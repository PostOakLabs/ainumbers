# Transfer-Pricing Interquartile Range Benchmark

OECD Transfer Pricing Guidelines Ch. III §3.57 interquartile-range arithmetic over a caller-declared array of already-selected comparable financial ratios: linear-interpolation quartiles (Q1/median/Q3), IQR, and a tested-party ratio-vs-range verdict (below/within/above range). Also computes the TNMM net-cost-plus and operating-margin ratios and the Berry ratio directly from caller-declared financial data. Comparable-set SELECTION and functional/DEMPE analysis are entirely caller judgment - this kernel performs no comparability analysis and never opines on which PLI applies; it is pure downstream arithmetic on an already-selected set. Cross-links art-456 GloBE safe-harbour (consumes the same underlying entity financial data for a different regime). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-473-interquartile-benchmark.html
- Markdown twin: https://ainumbers.co/chaingraph/art-473-interquartile-benchmark.md
- MCP tool: benchmark_tp_interquartile_range (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- comparable_ratios (array, required)
- financials (unknown, required)
- tested_party_ratio (number, required)

## Outputs

- comparable_count (integer, optional)
- iqr (number, optional)
- median (number, optional)
- missing_inputs (array, optional)
- not_a_comparable_selector (string, optional)
- q1 (number, optional)
- q3 (number, optional)
- range_verdict (string, optional)
- ratio_suite (object, optional)
- sorted_comparable_ratios (array, optional)
- tested_party_ratio (number, optional)

## Sample

```json
{
  "comparable_ratios": [
    0.02,
    0.03,
    0.035,
    0.04,
    0.045,
    0.05,
    0.06
  ],
  "tested_party_ratio": 0.038,
  "financials": {
    "revenue": 1000,
    "total_cost": 900,
    "operating_profit": 100,
    "gross_profit": 400,
    "operating_expenses": 250
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `benchmark_tp_interquartile_range` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

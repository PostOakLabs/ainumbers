# GloBE Transitional Safe Harbour Test Evaluator

Evaluates a jurisdiction against the OECD Pillar Two Transitional CbCR Safe Harbour (Dec 2022 Agreed Administrative Guidance): the de minimis test (CbCR revenue < EUR 10m AND profit before tax < EUR 1m, both versioned thresholds), the simplified ETR test (simplified covered taxes / profit before tax >= the fiscal-year transition rate - 15% for 2023/2024, 16% for 2025, 17% for 2026, versioned rate table; auto-passes when profit before tax is non-positive since ETR is undefined), and the routine profits test (profit before tax <= the caller-supplied substance-based income exclusion amount). Safe harbour is met if ANY ONE of the three tests passes, in which case the jurisdiction's top-up tax is deemed zero. Returns each test as an independently gated pass/fail verdict with its own reasoning, plus the overall safe_harbour_met / deemed_zero_topup flags. Pure arithmetic threshold comparisons only - elections, DTA characterization, and the SBIE amount itself are HUMAN JUDGMENT and enter only as policy_parameters; SBIE is not recomputed here (that is art-455's job). NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-456-globe-safe-harbour-tests.html
- Markdown twin: https://ainumbers.co/chaingraph/art-456-globe-safe-harbour-tests.md
- MCP tool: evaluate_globe_safe_harbour_tests (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- de_minimis_profit_threshold_eur (unknown, required)
- de_minimis_revenue_threshold_eur (unknown, required)
- fiscal_year (unknown, required)
- profit_before_tax_eur (unknown, required)
- revenue_eur (unknown, required)
- sbie_amount (unknown, required)
- simplified_covered_taxes (unknown, required)
- simplified_etr_rate_table (unknown, required)

## Outputs

- deemed_zero_topup (boolean, optional)
- fiscal_year (integer, optional)
- passing_test_ids (array, optional)
- safe_harbour_met (boolean, optional)
- tests (array, optional)

## Sample

```json
{
  "revenue_eur": 8000000,
  "profit_before_tax_eur": 500000,
  "simplified_covered_taxes": 10000,
  "fiscal_year": 2024,
  "sbie_amount": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `evaluate_globe_safe_harbour_tests` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

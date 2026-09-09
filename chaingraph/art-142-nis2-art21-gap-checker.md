# NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)

Check presence and maturity of all ten NIS2 Article 21(2)(a)–(j) cybersecurity risk-management measures. Derives per-measure maturity (0=absent, 1=documented-only, 2=implemented, 3=implemented+tested), aggregates to compliance score 0–100 and grade A–F, emits critical-gap list and prioritised remediation list. Consumes art-141 scope verdict; feeds penalty exposure calculator art-143.

- Page: https://ainumbers.co/chaingraph/art-142-nis2-art21-gap-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-142-nis2-art21-gap-checker.md
- MCP tool: check_nis2_art21_measures (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- measures (unknown, optional)

## Outputs

- compliance_score (integer, optional)
- critical_gaps (array, optional)
- measures_summary (array, optional)
- overall_grade (string, optional)
- remediation_priority (array, optional)

## Sample

```json
{
  "measures": [
    {
      "measure_id": "a",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "b",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "c",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "d",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "e",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "f",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "g",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "h",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "i",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    },
    {
      "measure_id": "j",
      "implemented": true,
      "documented": true,
      "last_tested_date": "2025-12-01"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_nis2_art21_measures` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

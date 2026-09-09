# SSI Conformance Checker

Lints standing settlement instructions for completeness, staleness, and format (~30%-of-fails root cause). BIC validated per ISO 9362. Staleness threshold configurable (default 90 days for T+1 cadence). Scores golden-source match rate and provider coverage.

- Page: https://ainumbers.co/chaingraph/art-80-ssi-conformance-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-80-ssi-conformance-checker.md
- MCP tool: check_ssi_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- ssi_records (unknown, optional)
- staleness_threshold_days (unknown, optional): Duration in days

## Outputs

- clean_records (integer, optional)
- format_errors (integer, optional)
- golden_source_coverage_pct (integer, optional)
- incomplete_records (integer, optional)
- match_rate (integer, optional)
- non_golden_source_count (integer, optional)
- note (string, optional)
- records_flagged (array, optional)
- reference (object, optional)
- staleness_breaches (integer, optional)
- staleness_threshold_days (integer, optional)
- total_records (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_ssi_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

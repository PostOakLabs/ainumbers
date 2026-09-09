# Screening List-Coverage Checker

Conformance check: validates a screening config against the required-coverage matrix for EU consolidated + UN + UK Sanctions List (post-OFSI-closure 28 Jan 2026) + OFAC SDN with correct jurisdictional-nexus gating.

- Page: https://ainumbers.co/chaingraph/art-92-screening-list-coverage-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-92-screening-list-coverage-checker.md
- MCP tool: check_screening_list_coverage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- config (unknown, optional)

## Outputs

- coverage_grade (string, optional)
- coverage_pct (integer, optional)
- missing_lists (array, optional)
- nexus_gaps (array, optional)
- note (string, optional)
- ofsi_migration_note (string, optional)
- reference_version (string, optional)
- refresh_adequate (boolean, optional)
- refresh_frequency_assessed (string, optional)
- required_lists (array, optional)
- sectoral_lists_screened (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_screening_list_coverage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

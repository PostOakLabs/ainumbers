# Circumvention Diligence Assessor

Scores a transaction/contract config vs the EU 20th-package (23 Apr 2026) no-Russia clause + anti-circumvention due-diligence, emitting a liability-allocation verdict (seller liability-shift where DD documented under the safe harbour).

- Page: https://ainumbers.co/chaingraph/art-95-circumvention-diligence-assessor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-95-circumvention-diligence-assessor.md
- MCP tool: assess_circumvention_diligence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- transaction (unknown, optional)

## Outputs

- controlled_goods_flag (boolean, optional)
- dd_gaps (array, optional)
- dd_score_pct (integer, optional)
- diligence_grade (string, optional)
- diversion_risk_flag (boolean, optional)
- eu_20th_package_note (string, optional)
- key_dates (object, optional)
- liability_allocation (string, optional)
- no_russia_clause_status (string, optional)
- note (string, optional)
- reference_version (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_circumvention_diligence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

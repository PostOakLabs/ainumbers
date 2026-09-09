# OECD Country-by-Country Report Builder

Builds an OECD BEPS Action 13 Country-by-Country Report XML schema skeleton from a caller-declared Table 1 (jurisdiction revenue/profit/tax/employee/asset data) and Table 2 (constituent-entity list) against a caller-declared, version-pinned Action 13 XML schema version. Runs internal consistency checks - per-jurisdiction revenue-component sums, employee/asset non-negativity, entity-jurisdiction referential integrity between Table 1 and Table 2 - and surfaces a profit-with-zero-employees anomaly flag for the downstream §27 review gate. Also produces EU Directive (EU) 2021/2101 and Australian public-CbCR field-subset export modes. NEVER a submission - not accepted by any national CbCR gateway; each jurisdiction's own portal runs its own additional validation. Comparable-set selection and transfer-pricing judgment stay out of scope (see art-473-interquartile-benchmark for arm's-length range arithmetic). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-472-cbcr-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-472-cbcr-builder.md
- MCP tool: build_cbcr_report (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- schema_version (string, optional)
- export_mode (string, optional)
- reporting_entity_name (string, optional)
- reporting_entity_tin (string, optional)
- table1_jurisdictions (array, optional)
- table2_entities (array, optional)
- rounding_tolerance (number, optional)

## Outputs

- all_fatal_passed (boolean, optional)
- anomaly_flags (array, optional)
- checks (array, optional)
- export_mode (string, optional)
- fatal_failure_count (integer, optional)
- gate_status (string, optional)
- jurisdictions (array, optional)
- not_submittable (string, optional)
- orphan_entities (array, optional)
- schema_version (string, optional)
- xml_schema_skeleton (object, optional)

## Sample

```json
{
  "schema_version": "oecd-cbcr-xml-3.0-2026-07-01",
  "export_mode": "private_filing",
  "reporting_entity_name": "Synthetic Global Holdings Ltd",
  "reporting_entity_tin": "SYN-TIN-000001",
  "table1_jurisdictions": [
    {
      "jurisdiction_code": "IE",
      "related_party_revenue": 400,
      "unrelated_party_revenue": 600,
      "total_revenue": 1000,
      "profit_before_tax": 200,
      "income_tax_paid": 25,
      "income_tax_accrued": 30,
      "stated_capital": 500,
      "accumulated_earnings": 1200,
      "number_of_employees": 50,
      "tangible_assets": 2000
    },
    {
      "jurisdiction_code": "DE",
      "related_party_revenue": 100,
      "unrelated_party_revenue": 900,
      "total_revenue": 1000,
      "profit_before_tax": 80,
      "income_tax_paid": 20,
      "income_tax_accrued": 22,
      "stated_capital": 300,
      "accumulated_earnings": 700,
      "number_of_employees": 120,
      "tangible_assets": 1500
    }
  ],
  "table2_entities": [
    {
      "entity_name": "Synthetic Ireland Ltd",
      "jurisdiction_code": "IE"
    },
    {
      "entity_name": "Synthetic Germany GmbH",
      "jurisdiction_code": "DE"
    }
  ],
  "rounding_tolerance": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_cbcr_report` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

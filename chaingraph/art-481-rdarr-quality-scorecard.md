# RDARR Quality Scorecard

Deterministic data-quality metrics over a SUPPLIED risk-data extract, keyed to the measurable RDARR prerequisites: completeness of mandatory attributes, referential integrity across the declared hierarchy, timeliness against a declared cut-off, reconciliation coverage, and manual-adjustment ratio. Each metric is scored against a policy-supplied threshold (never hardcoded) and labelled with its ECB Guide on effective risk data aggregation and risk reporting (3 May 2024) prerequisite area, so the result drops into an existing self-assessment. HARD FENCE: thresholds are policy inputs; this is never a supervisory pass mark, never a materiality judgement. Second entry of the BCBS 239 / RDARR family, feeding the rdarr-attestation-cycle chain alongside art-480-rdarr-aggregation-recompute (gate + attestation bundle). Not an aggregation recompute or any general risk-data ingester.

- Page: https://ainumbers.co/chaingraph/art-481-rdarr-quality-scorecard.html
- Markdown twin: https://ainumbers.co/chaingraph/art-481-rdarr-quality-scorecard.md
- MCP tool: rdarr_quality_scorecard (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cutoff_date (unknown, optional)
- extract (array, required)
- guide_version (unknown, optional)
- hierarchy_node_ids (array, required)
- mandatory_attributes (array, required)
- prerequisite_areas (unknown, required)
- thresholds (unknown, required)

## Outputs

- cutoff_date (string, optional)
- fence (string, optional)
- guide_version (string, optional)
- metrics (array, optional)
- not_proven (array, optional)
- scorecard (object, optional)
- total_records (integer, optional)

## Sample

```json
{
  "guide_version": "ECB Guide on effective risk data aggregation and risk reporting, 3 May 2024",
  "cutoff_date": "2026-06-30",
  "mandatory_attributes": [
    "exposure_class",
    "currency"
  ],
  "hierarchy_node_ids": [
    "RETAIL",
    "CORP"
  ],
  "thresholds": {
    "completeness_pct": 98,
    "referential_integrity_pct": 100,
    "timeliness_pct": 95,
    "reconciliation_coverage_pct": 90,
    "manual_adjustment_ratio_pct": 5
  },
  "extract": [
    {
      "record_id": "R1",
      "node_id": "RETAIL",
      "as_of_date": "2026-06-30",
      "reconciled": true,
      "manual_adjustment": false,
      "attributes": {
        "exposure_class": "retail",
        "currency": "USD"
      }
    },
    {
      "record_id": "R2",
      "node_id": "CORP",
      "as_of_date": "2026-07-01",
      "reconciled": true,
      "manual_adjustment": false,
      "attributes": {
        "exposure_class": "corp",
        "currency": "EUR"
      }
    },
    {
      "record_id": "R3",
      "node_id": "XXX",
      "as_of_date": "2026-06-29",
      "reconciled": false,
      "manual_adjustment": true,
      "attributes": {
        "exposure_class": "corp"
      }
    },
    {
      "record_id": "R4",
      "node_id": "RETAIL",
      "as_of_date": "2026-06-30",
      "reconciled": true,
      "manual_adjustment": false,
      "attributes": {
        "exposure_class": "retail",
        "currency": "USD"
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `rdarr_quality_scorecard` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Payment Data Migration Completeness

Verifies that data moved from a legacy system to a successor is complete, value-preserving, and reconcilable, using caller-declared per-partition source and target record counts and control totals rather than reading any dataset. Checks each declared partition for count and value completeness against a declared tolerance and known exclusions, and separately checks the aggregate (the sum of every partition) against the individual partitions - a grand total that reconciles while one or more partitions underneath do not is flagged as the inconsistency it is, not passed silently. Also checks transformation coverage (fields observed to change value with no declared transformation rule) and flags any partition verified by sampling only as a residual-risk statement, never as equivalent to a full completeness verdict. Region-portable: every fact is a caller-declared input, with no country, currency, agency, or rail hardcoded. Deterministic arithmetic only. Zero data ingestion, zero PII.

- Page: https://ainumbers.co/chaingraph/art-519-payment-data-migration-completeness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-519-payment-data-migration-completeness.md
- MCP tool: verify_migration_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- currency (string, required)
- declared_transformation_rules (array, required)
- migration_id (string, required)
- observed_changed_fields (array, required)
- partitions (array, required)
- reconciliation_tolerance_minor_units (number, required)

## Outputs

- aggregate_complete (boolean, optional)
- aggregate_count_variance (integer, optional)
- aggregate_value_variance_display (string, optional)
- aggregate_value_variance_minor_units (integer, optional)
- all_partitions_complete (boolean, optional)
- any_sampled_only (boolean, optional)
- as_of (string, optional)
- currency (string, optional)
- declared_transformation_rules (array, optional)
- migration_complete (boolean, optional)
- migration_id (string, optional)
- note (string, optional)
- observed_changed_field_count (integer, optional)
- partition_count (integer, optional)
- partition_inconsistent (boolean, optional)
- partitions (array, optional)
- partitions_with_variance_count (integer, optional)
- rationale (array, optional)
- reconciliation_tolerance_minor_units (integer, optional)
- rejected_inputs (array, optional)
- sample_discrepancies_total (integer, optional)
- sampled_partition_count (integer, optional)
- undeclared_transformed_fields (array, optional)

## Sample

```json
{
  "migration_id": "MIGR-2026-CASEDOCS-01",
  "as_of": "2026-07-31",
  "currency": "PAGES",
  "reconciliation_tolerance_minor_units": 0,
  "partitions": [
    {
      "partition_label": "CONTRACTS",
      "source_record_count": 4000,
      "source_control_total_minor_units": 1250000,
      "target_record_count": 3995,
      "target_control_total_minor_units": 1248500,
      "known_exclusions": [
        {
          "reason_code": "duplicate_scan_deduplicated_pre_migration",
          "excluded_record_count": 5,
          "excluded_value_minor_units": 1500
        }
      ]
    },
    {
      "partition_label": "CORRESPONDENCE",
      "source_record_count": 8000,
      "source_control_total_minor_units": 960000,
      "target_record_count": 8000,
      "target_control_total_minor_units": 960000,
      "known_exclusions": []
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_migration_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

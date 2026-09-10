# AI Training-Data Lineage Record

Composes a hash-chained ML training-data lineage record: dataset identity, dataset version, upstream source dataset references, a declared collection/governance method, and an OPTIONAL reference to an existing OCG receipt for the training-run compute (tool identity, execution hash, kernel digest - never re-embedded). Chains to a prior lineage record via sha256_prev_lineage_hash. Maps to EU AI Act Art 10 (data and data governance) + Annex IV 2(d) technical-documentation elements (data provenance, collection, labelling, cleaning); SR 11-7 model risk management data-lineage practice as the US domestic analog. Documents dataset lineage only - does not validate dataset quality, bias, or representativeness. Not build_ai_decision_log_record (art-236, per-inference decision chain) and not build_ai_workpaper_record (art-380, audit workpaper over a receipt).

- Page: https://ainumbers.co/chaingraph/art-452-build-ai-training-data-lineage-record.html
- Markdown twin: https://ainumbers.co/chaingraph/art-452-build-ai-training-data-lineage-record.md
- MCP tool: build_ai_training_data_lineage_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collection_method (unknown, required)
- dataset_id (unknown, required)
- dataset_version (unknown, required)
- governance_notes (unknown, required)
- operator_id (unknown, required)
- referenced_receipt_execution_hash (unknown, required)
- referenced_receipt_kernel_digest (unknown, required)
- referenced_receipt_tool_id (unknown, required)
- referenced_receipt_tool_version (unknown, required)
- retention_months (number, required)
- sha256_prev_lineage_hash (unknown, required)
- source_dataset_ids (unknown, required)

## Outputs

- chain_position (string, optional)
- checks (array, optional)
- collection_method (string, optional)
- dataset_id (string, optional)
- dataset_version (string, optional)
- governance_notes (string, optional)
- operator_id (string, optional)
- record_status (string, optional)
- referenced_receipt (string, optional)
- regulatory_basis (string, optional)
- retention_months (integer, optional)
- scope_note (string, optional)
- sha256_prev_lineage_hash (string, optional)
- source_dataset_ids (array, optional)
- table_version (string, optional)
- zero_pii_notice (string, optional)

## Sample

```json
{
  "dataset_id": "ds-credit-decisioning-2026q2",
  "dataset_version": "1.0.0",
  "source_dataset_ids": [
    "ds-core-banking-txn-log-2024-2026"
  ],
  "collection_method": "internal_transaction_records",
  "governance_notes": "Sourced from internal core-banking transaction extracts, deduplicated and de-identified prior to model training per firm data-governance policy.",
  "referenced_receipt_tool_id": "",
  "referenced_receipt_tool_version": "",
  "referenced_receipt_execution_hash": "",
  "referenced_receipt_kernel_digest": "",
  "sha256_prev_lineage_hash": "",
  "retention_months": 12,
  "operator_id": "mrm-data-governance-team"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_ai_training_data_lineage_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

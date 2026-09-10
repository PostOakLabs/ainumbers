# AI Decision Log Record Builder (EU AI Act Art 12)

Builds an EU AI Act Art 12(2)-conformant decision log record for high-risk AI systems in financial services. Computes chain_position (first/chained), art12_completeness_score (12 required fields), retention_months (>= 6 months, configurable), and anchor_surface instructions for composing anchor.ainumbers.co/mcp. subject_ref is a STRUCTURAL field only (opaque reference, never a real natural-person identifier; no PII enters this kernel). When the caller declares which sealed decision artifact this record evidences, this node also wraps it as a section-27.6 evidence bundle over that subject. Disambiguates from build_session_receipt (cry-01): that node logs MCP session I/O; this node builds a regulatory Art 12 decision record. Run classify_annex3_decisioning_obligations (art-238) first to confirm is_high_risk before generating Art 12 records.

- Page: https://ainumbers.co/chaingraph/art-236-build-ai-decision-log-record.html
- Markdown twin: https://ainumbers.co/chaingraph/art-236-build-ai-decision-log-record.md
- MCP tool: build_ai_decision_log_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confidence (number, optional)
- decision_label (unknown, required)
- human_accountability_records (array, required)
- input_digest (unknown, required)
- model_id (unknown, required)
- model_version (unknown, required)
- operator_id (unknown, required)
- output_digest (unknown, required)
- override_by (unknown, required)
- override_flag (unknown, required)
- retention_months (number, optional)
- sha256_prev_record (unknown, required)
- subject_hash (unknown, required)
- subject_ref (unknown, required)
- system_context (unknown, required)

## Outputs

- anchor_surface (string, optional)
- anchor_tools (object, optional)
- art12_completeness_score (integer, optional)
- art12_fields_present (boolean, optional)
- chain_position (string, optional)
- confidence (number, optional)
- decision_label (string, optional)
- enforcement_dates (object, optional)
- input_digest (string, optional)
- missing_art12_fields (array, optional)
- model_id (string, optional)
- model_version (string, optional)
- operator_id (string, optional)
- output_digest (string, optional)
- override_by (string, optional)
- override_flag (boolean, optional)
- pii_note (string, optional)
- record_status (string, optional)
- regulatory_basis (string, optional)
- retention_months (integer, optional)
- sha256_prev_record (string, optional)
- subject_ref (string, optional)
- system_context (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "model_id": "credit-ai-v2",
  "model_version": "2.1.0",
  "input_digest": "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
  "output_digest": "def456abc123def456abc123def456abc123def456abc123def456abc123def4",
  "decision_label": "CREDIT_APPROVED",
  "confidence": 0.92,
  "override_flag": false,
  "subject_ref": "CASE-0042",
  "retention_months": 12,
  "operator_id": "bank-xyz"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_ai_decision_log_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

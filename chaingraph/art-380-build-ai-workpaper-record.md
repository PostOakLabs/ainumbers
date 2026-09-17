# AI-Tool-Usage Workpaper Record

Composes a documentation-element workpaper record from an existing OCG receipt (tool identity, execution hash, kernel digest), a declared determinism class and conventions, engagement metadata, and a reviewer sign-off statement. Maps to the six elements firms must document for AI/technology-assisted audit evidence under amended AU-C 500 / PCAOB guidance: tool identity, inputs, outputs, limitations, sign-off, and optional linkage to a prior workpaper. An evidence format, not an audit opinion - makes no PCAOB or AICPA endorsement or compliance-sufficiency claim. An OPTIONAL section-16 eddsa-jcs-2022 signature on the emitted artifact turns the declared sign-off into a countersigned record. When the caller supplies a reviewer identity, the declared sign-off additionally remaps to a section-27.1 approval record over the referenced receipt's execution hash.

- Page: https://ainumbers.co/chaingraph/art-380-build-ai-workpaper-record.html
- Markdown twin: https://ainumbers.co/chaingraph/art-380-build-ai-workpaper-record.md
- MCP tool: build_ai_workpaper_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- declared_conventions (unknown, required)
- determinism_class (unknown, required)
- documentation_standard_ref (unknown, required)
- engagement_id (unknown, required)
- previous_workpaper_hash (unknown, required)
- receipt_execution_hash (unknown, required)
- receipt_generated_at (unknown, required)
- receipt_kernel_digest (unknown, required)
- receipt_tool_id (unknown, required)
- receipt_tool_version (unknown, required)
- reporting_period (unknown, required)
- reviewer_ha_role (unknown, required)
- reviewer_identity_id (unknown, required)
- reviewer_role (unknown, required)
- reviewer_statement (unknown, required)

## Outputs

- checks (array, optional)
- disclaimer (string, optional)
- documentation_standard_ref (string, optional)
- engagement (object, optional)
- evidence_binding (object, optional)
- limitations (object, optional)
- previous_workpaper_hash (string, optional)
- sign_off (object, optional)
- tool_identity (object, optional)
- zero_pii_notice (string, optional)

## Sample

```json
{
  "receipt_tool_id": "art-367-compute-cross-border-fees",
  "receipt_tool_version": "1.0.0",
  "receipt_execution_hash": "68a8b0eecde6775111d0301139900b213700c16917ccd395db4495f7f9bebf94",
  "receipt_kernel_digest": "sha256:ab7cc7c6345a21988fca592f503a6b89a4ddc3fe97267f8996170f1021619817",
  "receipt_generated_at": "2026-07-18T00:00:00.000Z",
  "determinism_class": "deterministic",
  "declared_conventions": "VAT/reverse-charge treatment, documentary-credit fees, and correspondent fees are caller-supplied inputs, not a vendored treaty table; the kernel applies only the published cost-stack formula.",
  "documentation_standard_ref": "AU-C 500 (as amended for AI/technology-assisted evidence), documentation elements per PCAOB audit-AI-tools research project (2026-05-05)",
  "engagement_id": "ENG-2026-0417",
  "reporting_period": "FY2026 Q2",
  "reviewer_role": "engagement_reviewer",
  "reviewer_statement": "",
  "previous_workpaper_hash": ""
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_ai_workpaper_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

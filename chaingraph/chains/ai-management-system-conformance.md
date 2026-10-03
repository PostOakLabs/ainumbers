# AI Management System Conformance

Assess ISO/IEC 42001 AIMS clause and Annex A control conformance with maturity scoring (art-171) -> validate AI impact assessment completeness across seven ISO 42005 elements (art-172) -> classify AI system to EU AI Act risk tier, NIST RMF profile, and ISO 42001 control set (art-173). Full AIMS conformance pipeline. ISO/IEC 42001 mandatory via enterprise AI-vendor RFP requirements (~40% EU, ~25% NA mid-2026); EU AI Act Art. 6-17 enforcement Aug 2026.

- Page: https://ainumbers.co/chaingraph/chains/ai-management-system-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-management-system-conformance.md

## Workflow chain: AI Management System Conformance

Assess ISO/IEC 42001 AIMS clause and Annex A control conformance with maturity scoring (art-171) -> validate AI impact assessment completeness across seven ISO 42005 elements (art-172) -> classify AI system to EU AI Act risk tier, NIST RMF profile, and ISO 42001 control set (art-173). Full AIMS conformance pipeline. ISO/IEC 42001 mandatory via enterprise AI-vendor RFP requirements (~40% EU, ~25% NA mid-2026); EU AI Act Art. 6-17 enforcement Aug 2026.

Domain: AI & Agent Governance

### Steps

1. art-171-iso42001-aims-clause-conformance
   AIMS clause maturity score and gaps feed impact assessment validator
2. art-172-ai-risk-impact-assessment-validator
   Impact assessment completeness feeds system governance classifier
3. art-173-ai-system-governance-classifier
   Exports EU AI Act tier, NIST RMF profile, ISO 42001 control set with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Internal audit says two AIMS controls lapsed last quarter. What maturity band does the management system hold once those gaps are recorded?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-management-system-conformance"} and read `art-171-iso42001-aims-clause-conformance.maturity_band`.
Re-run with `inputs` for `art-171-iso42001-aims-clause-conformance`, reusing the values that result echoed, with `aims` changed so clause_8_operation and annex_a_data_governance are false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-management-system-conformance.html

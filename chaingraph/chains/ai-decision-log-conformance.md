# AI Decision Log Conformance

Gated three-step chain for EU AI Act Art 12 decision-log conformance in financial services. Step 1 classifies Annex III FS obligations (art-238); gate on is_high_risk=true to proceed (OUT_OF_SCOPE exits). Step 2 builds the Art 12(2)-conformant decision log record (art-236), including art12_completeness_score and anchor_surface instructions. Step 3 validates the record as an IETF AAT agent audit trail (art-237), confirming chain_position and aat_completeness_score. Covers EU AI Act Art 12(2) logging, Art 26(6) FRIA, and Art 27(1) EU database registration.

- Page: https://ainumbers.co/chaingraph/chains/ai-decision-log-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-decision-log-conformance.md

## Workflow chain: AI Decision Log Conformance

Gated three-step chain for EU AI Act Art 12 decision-log conformance in financial services. Step 1 classifies Annex III FS obligations (art-238); gate on is_high_risk=true to proceed (OUT_OF_SCOPE exits). Step 2 builds the Art 12(2)-conformant decision log record (art-236), including art12_completeness_score and anchor_surface instructions. Step 3 validates the record as an IETF AAT agent audit trail (art-237), confirming chain_position and aat_completeness_score. Covers EU AI Act Art 12(2) logging, Art 26(6) FRIA, and Art 27(1) EU database registration.

Domain: AI & Agent Governance

### Steps

1. art-238-classify-annex3-decisioning-obligations
   Annex III FS obligation classification. Gate: is_high_risk=true continues to Art 12 log building; OUT_OF_SCOPE exits chain.
2. art-236-build-ai-decision-log-record
   Art 12(2) decision log record with completeness score and anchor instructions. Passes to audit trail validation.
3. art-237-validate-agent-audit-trail
   IETF AAT conformance result, aat_completeness_score, and validation errors. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our credit model decision log must be complete under the AI Act. What happens to the completeness score when the case reference goes missing?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-decision-log-conformance"} and read `art-236-build-ai-decision-log-record.art12_completeness_score`.
Re-run with `inputs` for `art-236-build-ai-decision-log-record`, reusing the values that result echoed, with `subject_ref` set to "". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-decision-log-conformance.html

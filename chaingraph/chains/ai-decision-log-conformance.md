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
